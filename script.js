import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.y = Math.PI; //rotate camera 180 degrees
camera.position.z = -6.5; //move camera back
camera.position.y = 3.5; //move camera up
camera.rotation.x = 0.2; //rotate camera down slightly

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const leftLight = new THREE.PointLight(0xf9db9a, 175, 0, 3);
leftLight.position.set(3.75, 6, -5);
scene.add(leftLight);

const rightLight = new THREE.PointLight(0xf9db9a, 175, 0, 3);
rightLight.position.set(-3.75, 6, -5);
scene.add(rightLight);

const fireLight = new THREE.PointLight(0xfe9902, 25, 0, 3);
fireLight.position.set(0, 1, -2);
scene.add(fireLight);


const loader = new GLTFLoader();
loader.load('./models/scene.glb', (gltfScene) => {
    scene.add(gltfScene.scene);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(time) {
    renderer.render(scene, camera);
}