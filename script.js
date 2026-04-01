import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject = null;

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
    gltfScene.scene.userData.ignoreRaycast = true;
    scene.add(gltfScene.scene);
});

loader.load('./models/brownieE.glb', (brownieE) => {
    brownieE.scene.scale.set(3, 3, 3);
    brownieE.scene.position.set(6.1, 2.8, -1);
    brownieE.scene.rotation.y = Math.PI + 0.7;
    scene.add(brownieE.scene);
});

loader.load('./models/agfaAnsco.glb', (agfaAnsco) => {
    agfaAnsco.scene.scale.set(3, 3, 3);
    agfaAnsco.scene.position.set(5.5, 2.8, -1);
    agfaAnsco.scene.rotation.y = Math.PI + 0.8;
    scene.add(agfaAnsco.scene);
});

loader.load('./models/polaroidLand.glb', (polaroidLand) => {
    polaroidLand.scene.scale.set(3, 3, 3);
    polaroidLand.scene.position.set(4.6, 2.8, -1.2);
    polaroidLand.scene.rotation.y = Math.PI + 0.7;
    scene.add(polaroidLand.scene);
});

loader.load('./models/hawkeyeInstamatic.glb', (hawkeyeInstamatic) => {
    hawkeyeInstamatic.scene.scale.set(3, 3, 3);
    hawkeyeInstamatic.scene.position.set(3.6, 2.85, -1.2);
    hawkeyeInstamatic.scene.rotation.y = Math.PI + 0.7;
    scene.add(hawkeyeInstamatic.scene);
});

loader.load('./models/fujifilmDL.glb', (fujifilmDL) => {
    fujifilmDL.scene.scale.set(3, 3, 3);
    fujifilmDL.scene.position.set(-3.6, 2.85, -1.2);
    fujifilmDL.scene.rotation.y = Math.PI - 0.3;
    scene.add(fujifilmDL.scene);
});

loader.load('./models/automaticBrownie.glb', (automaticBrownie) => {
    automaticBrownie.scene.scale.set(3, 3, 3);
    automaticBrownie.scene.position.set(-4.7, 2.85, -1.2);
    automaticBrownie.scene.rotation.y = Math.PI - 0.3;
    scene.add(automaticBrownie.scene);
});

loader.load('./models/brownieHawkeyeFlash.glb', (brownieHawkeyeFlash) => {
    brownieHawkeyeFlash.scene.scale.set(3, 3, 3);
    brownieHawkeyeFlash.scene.position.set(-5.6, 2.8, -1);
    brownieHawkeyeFlash.scene.rotation.y = Math.PI - 0.3;
    scene.add(brownieHawkeyeFlash.scene);
});

loader.load('./models/browniePremo.glb', (browniePremo) => {
    browniePremo.scene.scale.set(3, 3, 3);
    browniePremo.scene.position.set(-6.1, 2.8, -1);
    browniePremo.scene.rotation.y = Math.PI - 0.4;
    scene.add(browniePremo.scene);
});

loader.load('./models/advantixT70.glb', (advantixT70) => {
    advantixT70.scene.scale.set(3, 3, 3);
    advantixT70.scene.position.set(6.1, 1.75, -1);
    advantixT70.scene.rotation.y = -1.8;
    scene.add(advantixT70.scene);
});

loader.load('./models/starflash.glb', (starflash) => {
    starflash.scene.scale.set(3, 3, 3);
    starflash.scene.position.set(5.5, 1.75, -1);
    starflash.scene.rotation.y = Math.PI + 0.7;
    scene.add(starflash.scene);
});

loader.load('./models/tele-instamatic.glb', (teleinstamatic) => {
    teleinstamatic.scene.scale.set(3, 3, 3);
    teleinstamatic.scene.position.set(4.6, 1.9, -1.35);
    teleinstamatic.scene.rotation.y = Math.PI + 0.2;
    scene.add(teleinstamatic.scene);
});

loader.load('./models/canonEOS.glb', (canonEOS) => {
    canonEOS.scene.scale.set(3, 3, 3);
    canonEOS.scene.position.set(3.5, 1.8, -1.35);
    canonEOS.scene.rotation.y = 0.5;
    scene.add(canonEOS.scene);
});

loader.load('./models/brownieFiesta.glb', (brownieFiesta) => {
    brownieFiesta.scene.scale.set(3, 3, 3);
    brownieFiesta.scene.position.set(-3.5, 1.8, -1.35);
    brownieFiesta.scene.rotation.y = Math.PI - 0.5;
    scene.add(brownieFiesta.scene);
});

loader.load('./models/polaroidSun.glb', (polaroidSun) => {
    polaroidSun.scene.scale.set(3, 3, 3);
    polaroidSun.scene.position.set(-4.8, 1.75, -1.2);
    polaroidSun.scene.rotation.y = Math.PI - 0.6;
    scene.add(polaroidSun.scene);
});

loader.load('./models/brownie1A.glb', (brownie1A) => {
    brownie1A.scene.scale.set(3, 3, 3);
    brownie1A.scene.position.set(-5.4, 1.75, -1);
    brownie1A.scene.rotation.y = Math.PI - 0.3;
    scene.add(brownie1A.scene);
});

loader.load('./models/instamaticM22.glb', (instamaticM22) => {
    instamaticM22.scene.scale.set(3, 3, 3);
    instamaticM22.scene.position.set(-6, 1.7, -1.2);
    instamaticM22.scene.rotation.y = Math.PI - 0.7;
    scene.add(instamaticM22.scene);
});

loader.load('./models/instamaticX-15.glb', (instamaticX15) => {
    instamaticX15.scene.scale.set(3, 3, 3);
    instamaticX15.scene.position.set(6, 0.65, -1);
    instamaticX15.scene.rotation.y = Math.PI + 0.7;
    scene.add(instamaticX15.scene);
});

loader.load('./models/advantixF600.glb', (advantixF600) => {
    advantixF600.scene.scale.set(3, 3, 3);
    advantixF600.scene.position.set(5.3, 0.75, -1.2);
    advantixF600.scene.rotation.y = Math.PI + 0.5;
    scene.add(advantixF600.scene);
});

loader.load('./models/polaroidJoycam.glb', (polaroidJoycam) => {
    polaroidJoycam.scene.scale.set(3, 3, 3);
    polaroidJoycam.scene.position.set(4.7, 0.7, -1.2);
    polaroidJoycam.scene.rotation.y = Math.PI + 0.7;
    scene.add(polaroidJoycam.scene);
});

loader.load('./models/instaxMini.glb', (instaxMini) => {
    instaxMini.scene.scale.set(3, 3, 3);
    instaxMini.scene.position.set(3.5, 0.7, -1.35);
    instaxMini.scene.rotation.y = Math.PI + 0.3;
    scene.add(instaxMini.scene);
});

loader.load('./models/brownieHawkeyeC.glb', (brownieHawkeyeC) => {
    brownieHawkeyeC.scene.scale.set(3.5, 3.5, 3.5);
    brownieHawkeyeC.scene.position.set(-4.8, 0.7, -1.2);
    brownieHawkeyeC.scene.rotation.y = Math.PI - 0.6;
    scene.add(brownieHawkeyeC.scene);
});

loader.load('./models/diana.glb', (diana) => {
    diana.scene.scale.set(3, 3, 3);
    diana.scene.position.set(-5.4, 0.7, -1.2);
    diana.scene.rotation.y = Math.PI - 0.3;
    scene.add(diana.scene);
});

loader.load('./models/konica.glb', (konica) => {
    konica.scene.scale.set(3, 3, 3);
    konica.scene.position.set(-5.8, 0.7, -1.4);
    konica.scene.rotation.y = Math.PI - 0.9;
    scene.add(konica.scene);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
    renderer.render(scene, camera);
}