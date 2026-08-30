import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2 - 0.01;

// Physics world
const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.solver = new CANNON.GSSolver();
physicsWorld.solver.iterations = 10;
physicsWorld.allowSleep = true;

const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 3;
const physicsObjects = [];

// Lighting setup
function setupLighting() {
    // Hemisphere light for ambient fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8e8e8, 0.6);
    scene.add(hemiLight);

    // Main directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Fill lights
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight1.position.set(-10, 10, -10);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xf0f0f0, 0.2);
    fillLight2.position.set(0, -5, 0);
    scene.add(fillLight2);

    return { hemiLight, dirLight, fillLight1, fillLight2 };
}
const lights = setupLighting();

// Create ground plane
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(20, 20, 40, 40);
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        positions.setZ(i, Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.015);
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide
    });

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const groundShape = new CANNON.Box(new CANNON.Vec3(10, 0.1, 10));
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape,
        material: new CANNON.Material('ground'),
        position: new CANNON.Vec3(0, -0.1, 0)
    });
    physicsWorld.addBody(groundBody);

    physicsObjects.push({ mesh: groundMesh, body: groundBody, isStatic: true });
    window.groundMesh = groundMesh;
}

createGround();

const statsEl = document.getElementById('stats');
let lastTime = performance.now();
let frames = 0;

function updateStats() {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        const fps = Math.round(frames * 1000 / (now - lastTime));
        const bodies = physicsWorld.bodies.length;
        statsEl.textContent = `FPS: ${fps}\nBodies: ${bodies}`;
        frames = 0;
        lastTime = now;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min((performance.now() - lastTime) / 1000, 0.1);
    physicsWorld.step(FIXED_TIME_STEP, deltaTime, MAX_SUB_STEPS);

    for (const obj of physicsObjects) {
        if (!obj.isStatic) {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        }
    }

    controls.update();
    renderer.render(scene, camera);
    updateStats();
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.physicsWorld = physicsWorld;
window.physicsObjects = physicsObjects;
window.lights = lights;