import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hoveredObject = null; //tracks the currently hovered object
const interactableObjects = []; //tracks the objects that are interactable for raycasting


// CAMERA

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.y = Math.PI;
camera.position.set(0, 3.5, -6.5);
camera.rotation.x = 0.2;


// RENDERER

const renderer = new THREE.WebGLRenderer({ antialias: false }); //turn anti aliasing off for better performance
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); //cap the resolution for better performance
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// LIGHTS 

const leftLight = new THREE.PointLight(0xf9db9a, 175, 0, 3);
leftLight.position.set(3.75, 6, -5);
scene.add(leftLight);

const rightLight = new THREE.PointLight(0xf9db9a, 175, 0, 3);
rightLight.position.set(-3.75, 6, -5);
scene.add(rightLight);

const fireLight = new THREE.PointLight(0xfe9902, 25, 0, 3);
fireLight.position.set(0, 1, -2);
scene.add(fireLight);


// OPTIMIZATION FUNCTION

const loader = new GLTFLoader();

//applies various optimizations to interactable models to improve performance
function optimizeModel(obj) {
    obj.traverse((child) => {
        if (child.isMesh) {
            //disable shadows
            child.castShadow = false;
            child.receiveShadow = false;

            // freeze transforms
            child.matrixAutoUpdate = false;
            child.updateMatrix();

            // ensure emissive exists
            if (child.material && child.material.emissive) {
                child.material.emissive.set(0x000000);
            }
        }
    });
    //freeze root transform
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
}


// LOADER FUNCTION

//;pads models with optimizations and adds them to the scene and list of interactable objects
function loadModel(path, scale, pos, rot) {
    loader.load(path, (gltf) => {
        const obj = gltf.scene;

        obj.scale.set(scale, scale, scale);
        obj.position.set(...pos);
        obj.rotation.y = rot;

        optimizeModel(obj);

        scene.add(obj);
        interactableObjects.push(obj);
    });
}


// BACKGROUND SCENE

loader.load('./models/scene.glb', (gltfScene) => {
    const obj = gltfScene.scene;
    optimizeModel(obj);
    scene.add(obj);
});


// MODELS

loadModel('./models/brownieE.glb', 3, [6.1, 2.8, -1], Math.PI + 0.7);
loadModel('./models/agfaAnsco.glb', 3, [5.5, 2.8, -1], Math.PI + 0.8);
loadModel('./models/polaroidLand.glb', 3, [4.6, 2.8, -1.2], Math.PI + 0.7);
loadModel('./models/hawkeyeInstamatic.glb', 3, [3.6, 2.85, -1.2], Math.PI + 0.7);

loadModel('./models/fujifilmDL.glb', 3, [-3.6, 2.85, -1.2], Math.PI - 0.3);
loadModel('./models/automaticBrownie.glb', 3, [-4.7, 2.85, -1.2], Math.PI - 0.3);
loadModel('./models/brownieHawkeyeFlash.glb', 3, [-5.6, 2.8, -1], Math.PI - 0.3);
loadModel('./models/browniePremo.glb', 3, [-6.1, 2.8, -1], Math.PI - 0.4);

loadModel('./models/advantixT70.glb', 3, [6.1, 1.75, -1], -1.8);
loadModel('./models/starflash.glb', 3, [5.5, 1.75, -1], Math.PI + 0.7);
loadModel('./models/tele-instamatic.glb', 3, [4.6, 1.9, -1.35], Math.PI + 0.2);
loadModel('./models/canonEOS.glb', 3, [3.5, 1.8, -1.35], 0.5);

loadModel('./models/brownieFiesta.glb', 3, [-3.5, 1.8, -1.35], Math.PI - 0.5);
loadModel('./models/polaroidSun.glb', 3, [-4.8, 1.75, -1.2], Math.PI - 0.6);
loadModel('./models/brownie1A.glb', 3, [-5.4, 1.75, -1], Math.PI - 0.3);
loadModel('./models/instamaticM22.glb', 3, [-6, 1.7, -1.2], Math.PI - 0.7);

loadModel('./models/instamaticX-15.glb', 3, [6, 0.65, -1], Math.PI + 0.7);
loadModel('./models/advantixF600.glb', 3, [5.3, 0.75, -1.2], Math.PI + 0.5);
loadModel('./models/polaroidJoycam.glb', 3, [4.7, 0.7, -1.2], Math.PI + 0.7);
loadModel('./models/instaxMini.glb', 3, [3.5, 0.7, -1.35], Math.PI + 0.3);

loadModel('./models/brownieHawkeyeC.glb', 3.5, [-4.8, 0.7, -1.2], Math.PI - 0.6);
loadModel('./models/diana.glb', 3, [-5.4, 0.7, -1.2], Math.PI - 0.3);
loadModel('./models/konica.glb', 3, [-5.8, 0.7, -1.4], Math.PI - 0.9);


// EVENTS

//handles window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//handles mouse movement and updates the mouse vector for raycasting
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});


// HIGHLIGHT FUNCTION

//applies a subtle emissive highlight to the hovered object and its children
function setHighlight(object, on) {
    object.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.set(on ? 0x333333 : 0x000000);
        }
    });
}


// ANIMATION

function animate() {
    requestAnimationFrame(animate);

    raycaster.setFromCamera(mouse, camera); //update the raycaster with the current mouse position and camera
    const intersects = raycaster.intersectObjects(interactableObjects, true); //check intersections with interactable objects

    if (intersects.length > 0) { //if there's an intersection, find the root model of the intersected object
        let object = intersects[0].object;

        while (object.parent && !object.parent.isScene) { //get the root model of the intersected object
            object = object.parent;
        }

        if (hoveredObject !== object) { //if the hovered object has changed, update the highlight
            if (hoveredObject) {
                setHighlight(hoveredObject, false);
            }
            hoveredObject = object;
            setHighlight(hoveredObject, true);
        }
    } else { //otherwise, if there are no intersections, remove the highlight from the previously hovered object
        if (hoveredObject) {
            setHighlight(hoveredObject, false);
        }
        hoveredObject = null;
    }
    renderer.render(scene, camera);
}
animate();