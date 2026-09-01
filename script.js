import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const CONFIG = {
    groundSize: 20,
    wallHeight: 5,
    wallThickness: 0.5,
    maxBodies: 100,
    cleanupY: -10,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 3,
    colorPalette: [0x4A90D9, 0xE85D4D, 0x50C878, 0xF5A623, 0x9B59B6, 0x2ECC71, 0xE74C3C, 0x3498DB]
};

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

const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.solver = new CANNON.GSSolver();
physicsWorld.solver.iterations = 10;
physicsWorld.allowSleep = true;
physicsWorld.sleepSpeedLimit = 0.1;
physicsWorld.sleepTimeLimit = 1;


const groundMaterial = new CANNON.Material('ground');
const dynamicMaterial = new CANNON.Material('dynamic');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, dynamicMaterial, {
    friction: 0.3,
    restitution: 0.3,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
});
physicsWorld.addContactMaterial(contactMaterial);

const physicsObjects = [];

function setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8e8e8, 0.6);
    scene.add(hemiLight);

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

    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight1.position.set(-10, 10, -10);
    scene.add(fillLight1);
}
setupLighting();

function createGround() {
    const halfSize = CONFIG.groundSize / 2;
    const groundGeometry = new THREE.PlaneGeometry(CONFIG.groundSize, CONFIG.groundSize, 40, 40);
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        positions.setZ(i, Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.015);
    }
    groundGeometry.computeVertexNormals();

    const groundMaterialThree = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide
    });

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterialThree);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const groundShape = new CANNON.Box(new CANNON.Vec3(halfSize, 0.1, halfSize));
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape,
        material: groundMaterial,
        position: new CANNON.Vec3(0, -0.1, 0)
    });
    physicsWorld.addBody(groundBody);

    physicsObjects.push({ mesh: groundMesh, body: groundBody, isStatic: true });
    window.groundMesh = groundMesh;
}
createGround();

function createBoundaries() {
    const halfSize = CONFIG.groundSize / 2;
    const wallH = CONFIG.wallHeight;
    const wallT = CONFIG.wallThickness;
    const wallDepth = CONFIG.groundSize + wallT * 2;

    const walls = [
        { pos: [0, wallH / 2, -halfSize - wallT / 2], size: [halfSize, wallH / 2, wallT / 2] },
        { pos: [0, wallH / 2, halfSize + wallT / 2], size: [halfSize, wallH / 2, wallT / 2] },
        { pos: [-halfSize - wallT / 2, wallH / 2, 0], size: [wallT / 2, wallH / 2, wallDepth] },
        { pos: [halfSize + wallT / 2, wallH / 2, 0], size: [wallT / 2, wallH / 2, wallDepth] }
    ];

    walls.forEach(wall => {
        const shape = new CANNON.Box(new CANNON.Vec3(...wall.size));
        const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: groundMaterial,
            position: new CANNON.Vec3(...wall.pos)
        });
        physicsWorld.addBody(body);
        physicsObjects.push({ mesh: null, body, isStatic: true });
    });
}
createBoundaries();

function getRandomColor() {
    return CONFIG.colorPalette[Math.floor(Math.random() * CONFIG.colorPalette.length)];
}

function createBox(size, color, mass, position) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
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
        material: dynamicMaterial,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: simState.airResistance,
        angularDamping: simState.airResistance
    });
    body.restitution = simState.restitution;
    body.friction = simState.friction;
    physicsWorld.addBody(body);

    physicsObjects.push({ mesh, body, isStatic: false });
    return { mesh, body };
}

function createSphere(radius, color, mass, position) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
        mass,
        shape,
        material: dynamicMaterial,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: simState.airResistance,
        angularDamping: simState.airResistance
    });
    body.restitution = simState.restitution;
    body.friction = simState.friction;
    physicsWorld.addBody(body);

    physicsObjects.push({ mesh, body, isStatic: false });
    return { mesh, body };
}

const spawnSettings = {
    mass: 2.5,
    size: 1.0,
    restitution: 0.3,
    friction: 0.3,
    shape: 'random',
    airResistance: 0.01
};

const simState = {
    timeScale: 1.0,
    paused: false
};

function spawnObjectAt(x, z) {
    const dynamicCount = physicsObjects.filter(o => !o.isStatic).length;
    if (dynamicCount >= CONFIG.maxBodies) {
        for (let i = 0; i < physicsObjects.length; i++) {
            if (!physicsObjects[i].isStatic) {
                removeObject(i);
                break;
            }
        }
    }

    const isBox = spawnSettings.shape === 'random' ? Math.random() > 0.5 : spawnSettings.shape === 'box';
    const size = spawnSettings.size;
    const mass = spawnSettings.mass;
    const color = getRandomColor();
    const y = isBox ? size / 2 + 2 : size + 2;
    const position = new THREE.Vector3(x, y, z);

    if (isBox) createBox(size, color, mass, position);
    else createSphere(size, color, mass, position);
}

function removeObject(index) {
    const obj = physicsObjects[index];
    if (!obj) return;
    if (obj.mesh) {
        scene.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        obj.mesh.material.dispose();
    }
    physicsWorld.removeBody(obj.body);
    physicsObjects.splice(index, 1);
}

function cleanupFallenObjects() {
    for (let i = physicsObjects.length - 1; i >= 0; i--) {
        const obj = physicsObjects[i];
        if (!obj.isStatic && obj.body.position.y < CONFIG.cleanupY) {
            removeObject(i);
        }
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    if (event.target.closest('.control-panel')) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(window.groundMesh);
    if (intersects.length > 0) {
        spawnObjectAt(intersects[0].point.x, intersects[0].point.z);
    }
}
renderer.domElement.addEventListener('click', onMouseClick);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            spawnObjectAt((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
            break;
        case 'KeyR':
            resetScene();
            break;
        case 'KeyC':
            clearDynamicObjects();
            break;
        case 'KeyP':
            togglePause();
            break;
    }
});

const panel = document.getElementById('controlPanel');
const panelToggle = document.getElementById('panelToggle');
panelToggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    panelToggle.textContent = panel.classList.contains('collapsed') ? 'Expand' : 'Collapse';
});

function flashValue(el) {
    el.classList.add('changed');
    setTimeout(() => el.classList.remove('changed'), 300);
}

document.getElementById('gravitySlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('gravityValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('gravityValue'));
    physicsWorld.gravity.y = val;
});

document.getElementById('gravityXSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('gravityXValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('gravityXValue'));
    physicsWorld.gravity.x = val;
});

document.getElementById('gravityZSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('gravityZValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('gravityZValue'));
    physicsWorld.gravity.z = val;
});

document.getElementById('airResistanceSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('airResistanceValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('airResistanceValue'));
    spawnSettings.airResistance = val;
    physicsObjects.forEach(obj => {
        if (!obj.isStatic) {
            obj.body.linearDamping = val;
            obj.body.angularDamping = val;
        }
    });
});

document.getElementById('iterationsSlider').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('iterationsValue').textContent = val;
    flashValue(document.getElementById('iterationsValue'));
    physicsWorld.solver.iterations = val;
});

document.getElementById('timeScaleSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('timeScaleValue').textContent = val.toFixed(1);
    flashValue(document.getElementById('timeScaleValue'));
    simState.timeScale = val;
});

document.getElementById('massSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('massValue').textContent = val.toFixed(1);
    flashValue(document.getElementById('massValue'));
    spawnSettings.mass = val;
});

document.getElementById('sizeSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('sizeValue').textContent = val.toFixed(1);
    flashValue(document.getElementById('sizeValue'));
    spawnSettings.size = val;
});

document.getElementById('restitutionSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('restitutionValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('restitutionValue'));
    spawnSettings.restitution = val;
    contactMaterial.restitution = val;
    physicsObjects.forEach(obj => {
        if (!obj.isStatic) obj.body.restitution = val;
    });
});

document.getElementById('frictionSlider').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('frictionValue').textContent = val.toFixed(2);
    flashValue(document.getElementById('frictionValue'));
    spawnSettings.friction = val;
    contactMaterial.friction = val;
    physicsObjects.forEach(obj => {
        if (!obj.isStatic) obj.body.friction = val;
    });
});

document.getElementById('shapeSelect').addEventListener('change', (e) => {
    spawnSettings.shape = e.target.value;
});

document.getElementById('spawnBtn').addEventListener('click', () => {
    spawnObjectAt((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
});

function clearDynamicObjects() {
    for (let i = physicsObjects.length - 1; i >= 0; i--) {
        if (!physicsObjects[i].isStatic) removeObject(i);
    }
}
document.getElementById('clearBtn').addEventListener('click', clearDynamicObjects);

function resetScene() {
    clearDynamicObjects();
    document.getElementById('gravitySlider').value = -9.82;
    document.getElementById('gravityValue').textContent = '-9.82';
    document.getElementById('gravityXSlider').value = 0;
    document.getElementById('gravityXValue').textContent = '0.00';
    document.getElementById('gravityZSlider').value = 0;
    document.getElementById('gravityZValue').textContent = '0.00';
    document.getElementById('airResistanceSlider').value = 0.01;
    document.getElementById('airResistanceValue').textContent = '0.01';
    document.getElementById('iterationsSlider').value = 10;
    document.getElementById('iterationsValue').textContent = '10';
    document.getElementById('timeScaleSlider').value = 1;
    document.getElementById('timeScaleValue').textContent = '1.0';
    document.getElementById('massSlider').value = 2.5;
    document.getElementById('massValue').textContent = '2.5';
    document.getElementById('sizeSlider').value = 1.0;
    document.getElementById('sizeValue').textContent = '1.0';
    document.getElementById('restitutionSlider').value = 0.3;
    document.getElementById('restitutionValue').textContent = '0.30';
    document.getElementById('frictionSlider').value = 0.3;
    document.getElementById('frictionValue').textContent = '0.30';
    document.getElementById('shapeSelect').value = 'random';

    physicsWorld.gravity.set(0, -9.82, 0);
    physicsWorld.solver.iterations = 10;
    simState.timeScale = 1.0;
    simState.paused = false;
    spawnSettings.mass = 2.5;
    spawnSettings.size = 1.0;
    spawnSettings.restitution = 0.3;
    spawnSettings.friction = 0.3;
    spawnSettings.shape = 'random';
    spawnSettings.airResistance = 0.01;
    contactMaterial.restitution = 0.3;
    contactMaterial.friction = 0.3;
    document.getElementById('pauseBtn').textContent = 'Pause';
}
document.getElementById('resetBtn').addEventListener('click', resetScene);

function togglePause() {
    simState.paused = !simState.paused;
    document.getElementById('pauseBtn').textContent = simState.paused ? 'Resume' : 'Pause';
}
document.getElementById('pauseBtn').addEventListener('click', togglePause);

const statsEl = document.getElementById('stats');
const liveStatsEl = document.getElementById('liveStats');
let lastTime = performance.now();
let frames = 0;

function updateStats() {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        const fps = Math.round(frames * 1000 / (now - lastTime));
        const dynamicBodies = physicsObjects.filter(o => !o.isStatic).length;
        statsEl.textContent = `FPS: ${fps}\nBodies: ${physicsWorld.bodies.length}`;
        liveStatsEl.textContent = `Dynamic bodies: ${dynamicBodies}\nStatic bodies: ${physicsObjects.filter(o => o.isStatic).length}\nContacts: ${physicsWorld.contacts.length}\nTime scale: ${simState.timeScale.toFixed(1)}x`;
        frames = 0;
        lastTime = now;
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (!simState.paused) {
        const deltaTime = Math.min((performance.now() - lastTime) / 1000, 0.1);
        physicsWorld.step(CONFIG.fixedTimeStep, deltaTime * simState.timeScale, CONFIG.maxSubSteps);
    }

    for (const obj of physicsObjects) {
        if (!obj.isStatic && obj.mesh) {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        }
    }

    cleanupFallenObjects();

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

window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.controls = controls;
window.physicsWorld = physicsWorld;
window.physicsObjects = physicsObjects;
window.CANNON = CANNON;
window.spawnObjectAt = spawnObjectAt;
window.simState = simState;
window.spawnSettings = spawnSettings;
window.CONFIG = CONFIG;