import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Light gray background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 20); // Good viewing position: up, back, and slightly to the side
camera.lookAt(0, 0, 0); // Look at the origin

// Renderer
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
controls.minDistance = 5;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2 - 0.1;

// Add helpers for better depth perception and orientation
const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xeeeeee);
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(15);
scene.add(axesHelper);

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

// Lighting - bright and clear
function setupLighting() {
    // Ambient light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf0f0f0, 0.8);
    scene.add(hemiLight);

    // Main directional light (sun-like)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Fill light from opposite direction
    const fillLight = new THREE.DirectionalLight(0xfff0f0, 0.6);
    fillLight.position.set(-15, 20, -15);
    scene.add(fillLight);
}
setupLighting();

// Color palette - vibrant, clearly visible colors
const COLOR_PALETTE = [0xFF3B30, 0xFF9500, 0xFFCC00, 0x34C759, 0x007AFF, 0x5856D6, 0xFF2D55];
function getRandomColor() {
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

// Ground - clearly visible and stable
function createGround() {
    const groundSize = 30; // Make it larger for more spawn area
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 60, 60);

    // Add subtle wave pattern for shadow depth and visual interest
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        // Create gentle waves for shadow variation
        positions.setZ(i, (Math.sin(x * 0.2) * Math.cos(y * 0.2) * 0.3));
    }
    groundGeometry.computeVertexNormals();

    // WHITE GROUND - pure white for maximum visibility against light gray background
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8, // Slightly less rough for better shadow reception
        metalness: 0.0,
        side: THREE.DoubleSide
    });

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    groundMesh.position.y = 0; // At origin height
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Physics ground - slightly thinner for performance
    const groundShape = new CANNON.Box(new CANNON.Vec3(groundSize / 2, 0.05, groundSize / 2));
    const groundBody = new CANNON.Body({
        mass: 0, // Static body
        shape: groundShape,
        material: new CANNON.Material('ground'),
        position: new CANNON.Vec3(0, -0.05, 0) // Slightly below visual to prevent fighting
    });
    physicsWorld.addBody(groundBody);

    // Store references
    physicsObjects.push({ mesh: groundMesh, body: groundBody, isStatic: true });
    window.groundMesh = groundMesh; // FIXED: Was incorrectly window.groundMesh = window.groundMesh
}
createGround();

// Spawn function
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function createBox(size, color, mass, position) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const halfExtents = new CANNON.Vec3(size / 2, size / 2, size / 2);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
        mass,
        shape,
        material: new CANNON.Material('dynamic'),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: 0.01,
        angularDamping: 0.01
    });
    physicsWorld.addBody(body);

    physicsObjects.push({ mesh, body, isStatic: false });
}

function createSphere(radius, color, mass, position) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
        mass,
        shape,
        material: new CANNON.Material('dynamic'),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: 0.01,
        angularDamping: 0.01
    });
    physicsWorld.addBody(body);

    physicsObjects.push({ mesh, body, isStatic: false });
}

function spawnObjectAt(x, z) {
    // Reasonable size range for visibility
    const isBox = Math.random() > 0.5;
    const size = 0.8 + Math.random() * 1.2; // Size range: 0.8 to 2.0
    const mass = 0.5 + Math.random() * 2.0; // Mass range: 0.5 to 2.5
    const color = getRandomColor();

    // Spawn well above ground to see the fall
    const spawnHeight = 5.0;
    const position = new THREE.Vector3(x, spawnHeight, z);

    if (isBox) createBox(size, color, mass, position);
    else createSphere(size, color, mass, position);
}

function onMouseClick(event) {
    // Prevent spawning when clicking on UI elements
    const uiSelectors = ['.info-panel', '.stats', '.spawn-hint'];
    const isClickOnUI = uiSelectors.some(selector =>
        event.target.closest(selector)
    );

    if (isClickOnUI) {
        return;
    }

    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check if groundMesh exists before raycasting
    if (!window.groundMesh) {
        console.error('Ground mesh not found for raycasting!');
        return;
    }

    // Raycast against the ground mesh
    const intersects = raycaster.intersectObject(window.groundMesh, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        spawnObjectAt(intersect.point.x, intersect.point.z);
    }
    // Optional: uncomment for debugging
    // else {
    //     console.log('No ground intersection - clicking in sky or missed ground');
    // }
}

// Attach event listeners
renderer.domElement.addEventListener('click', onMouseClick);
renderer.domElement.addEventListener('mousedown', (event) => event.preventDefault());

// Stats display
const statsEl = document.getElementById('stats');
let lastTime = performance.now();
let frames = 0;

function updateStats() {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        const fps = Math.round(frames * 1000 / (now - lastTime));
        statsEl.textContent = `FPS: ${fps}\nBodies: ${physicsWorld.bodies.length}`;
        frames = 0;
        lastTime = now;
    }
}

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = Math.min((performance.now() - lastTime) / 1000, 0.1);
    physicsWorld.step(FIXED_TIME_STEP, deltaTime, MAX_SUB_STEPS);

    // Update visual objects from physics bodies
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

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Expose for debugging
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.controls = controls;
window.physicsWorld = physicsWorld;
window.physicsObjects = physicsObjects;
window.spawnObjectAt = spawnObjectAt;
window.groundMesh = groundMesh; // FIXED: Was incorrectly window.groundMesh = window.groundMesh