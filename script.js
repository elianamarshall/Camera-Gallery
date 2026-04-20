import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const cameraPopup = document.getElementById('camera-popup'); //get the camera popup element for displaying camera information
const popupContent = document.getElementById('popup-content'); //get the popup content element for displaying the title, year, and description of the camera
const closeButton = document.getElementById('close-button'); //get the close button element for closing the camera popup
const origCameraPos = new THREE.Vector3(0, 3.5, -6.5); //store the original camera position to return to when closing the popup
const origLookTarget = new THREE.Vector3(0, 2, 0); //store the original look target to return to when closing the popup

let introOpen = true; //tracks whether or not the intro pop-up is open
let hoveredObject = null; //tracks the currently hovered object
let targetPosition = new THREE.Vector3(); //tracks where the camera should move to when zooming in on an object
let isZooming = false; //tracks whether or not the camera is zooming in on an object
let lookTarget = new THREE.Vector3(); //tracks where the camera should look when zooming in on an object
let lookingAtObject = false; //tracks whether or not the camera is currently looking at an object
const interactableObjects = []; //tracks the objects that are interactable for raycasting

const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

const totalModels = 27;
let loadedModels = 0;


// CAMERA

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.y = Math.PI;
camera.position.copy(origCameraPos);
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


// LOADER FUNCTION & LOADING SCREEN

//updates the loading screen when a new model is loaded into the scene, and fades it out when all models are loaded
function updateLoadingScreen() {
    const progress = Math.floor((loadedModels / totalModels) * 100);
    loadingText.textContent = `Loading... ${progress}%`;

    if (loadedModels == totalModels) {
        loadingScreen.style.transition = 'opacity 1s ease';
        loadingScreen.style.opacity = 0;

        setTimeout(() => {
            loadingScreen.style.display = 'none';

            //display the intro pop-up
            const introPopup = document.getElementById('intro-popup');
            const introButton = document.getElementById('intro-button');

            introPopup.classList.add('show');
            introButton.classList.add('show');

            introButton.addEventListener('click', () => {
                introPopup.classList.remove('show');
                introButton.classList.remove('show');
                introOpen = false;
            });
        }, 1000);
    }
}

//loads models with optimizations and adds them to the scene and list of interactable objects
function loadModel(path, scale, pos, rot, info) {
    loader.load(path, (gltf) => {
        const obj = gltf.scene;

        obj.scale.set(scale, scale, scale);
        obj.position.set(...pos);
        obj.rotation.y = rot;
        obj.userData = info;

        optimizeModel(obj);

        scene.add(obj);
        interactableObjects.push(obj);

        loadedModels++;
        updateLoadingScreen();
    });
}


// MODELS

loader.load('./models/scene.glb', (gltfScene) => {
    const obj = gltfScene.scene;
    optimizeModel(obj);
    scene.add(obj);
    loadedModels++;
    updateLoadingScreen();
});

loadModel('./models/brownieE.glb', 3, [6.1, 2.8, -1], Math.PI + 0.7, {
    name: 'Kodak No. 2 Brownie Box Model E',
    year: '1920',
    description: 'This camera model was widely popular due to its affordability and durability. It was the first camera to introduce a metal body rather than wood, making it sturdier than most other cameras. It was just $1.00 when it was released, which is approximately equivalent to $16.34 in 2026. It was also the first camera to use 120 film!'
});

loadModel('./models/agfaAnsco.glb', 3, [5.5, 2.8, -1], Math.PI + 0.8, {
    name: `Agfa Ansco No. 1 Readyset Royal Folding Camera`,
    year: '1931',
    description: 'This camera is quite peculiar in that it functions like a box camera, but folds out. Traditionally, folding cameras offered portability and advanced manual controls, while box cameras were considered “point-and-shoot” cameras. The Readyset was designed to be both portable and simple, so it was collapsible but also considered a “point-and-shoot” camera. '
});

loadModel('./models/polaroidLand.glb', 3, [4.6, 2.8, -1.2], Math.PI + 0.7, {
    name: 'Polaroid Spirit',
    year: '1982',
    description: 'This camera line is unique in that the battery that powers the camera is built into the film pack itself, not the camera body. This meant that every time you bought new film, you also got a new battery! The Spirit was also the first Polaroid camera to use a new and improved film that developed 4x faster than the film used by previous Polaroid models.'
});

loadModel('./models/hawkeyeInstamatic.glb', 3, [3.6, 2.85, -1.2], Math.PI + 0.7, {
    name: 'Kodak Hawkeye Instamatic R4',
    year: '1965',
    description: 'The Hawkeye Instamatic R4 is best known for its distinctive green and silver design. It was also a part of the line of cameras that introduced the 126 cartridge film, which eliminated the need to thread film. Additionally, it was designed to use 4-bulb flashcubes that rotated automatically after each shot, allowing four shots before needing to change the flash. Unlike flash nowadays, they used to only be single-use because they relied on a physical chemical reaction to ignite the bulb, which would instantly burn out in an intense flash.'
});

loadModel('./models/fujifilmDL.glb', 3, [-3.6, 2.85, -1.2], Math.PI - 0.3, {
    name: 'Fujifilm DL-270 Zoom Super',
    year: '1994',
    description: 'This camera uniquely uses a “prewind” system for film loading, which is a reverse-counting mechanism. Essentially, when you load a new roll of film, the camera instantly winds the entire roll onto the take-up spool and counts down to 0 as you take pictures. This ensures that if the backing is accidentally opened, the pictures already taken are protected from light inside of the cassette.'
});

loadModel('./models/automaticBrownie.glb', 3, [-4.7, 2.85, -1.2], Math.PI - 0.3, {
    name: 'Kodak No. 3A Folding Brownie',
    year: '1909',
    description: 'The 3A Folding Brownie was the first in the Brownie series designed to create postcard sized photos, making it easy to send photos through the mail. It used 122 film to achieve this postcard formatting. It was also visually set apart from other Brownie cameras as it features red bellows rather than the standard black.'
});

loadModel('./models/brownieHawkeyeFlash.glb', 3, [-5.6, 2.8, -1], Math.PI - 0.3, {
    name: 'Kodak Brownie Hawkeye Flash',
    year: '1950',
    description: 'The Brownie Hawkeye Flash is recognized as one of the most popular Brownie cameras made–and there were a lot of them! It’s easy to use and comes apart very easily to clean the lens and viewfinder. Most Hawkeye Flash’s will also accept 120 film without respooling it onto a 620 spool, even though the camera was designed for a 620 spool. This is very useful because 620 film was discontinued in 1995, but 120 film is still widely used!'
});

loadModel('./models/browniePremo.glb', 3, [-6.1, 2.8, -1], Math.PI - 0.4, {
    name: 'Kodak Premo Junior',
    year: '1908',
    description: 'The Premo Junior was designed to be a very simple and affordable box camera for amateurs, and was notably marketed towards children. Unlike most other Brownie cameras of that time, the Premo Junior used a 12-exposure Premo Film Pack to allow photographers to remove and develop individual exposures before the entire pack was finished. The film packs also used paper tabs to change exposures.'
});

loadModel('./models/advantixT70.glb', 3, [6.1, 1.75, -1], -1.8, {
    name: 'Kodak ADVANTiX T70',
    year: '1998',
    description: 'The ADVANTiX T70 features a safety interlock system, which only allows the film door to open after the film has been completely rewound into the cassette. This is designed to prevent accidental exposure of the film. The T70 also included three different built-in aspect ratios for photos: Classic (C), High Definition (H), and Panorama (P). Additionally, the T70 had an automatic memory system, which would record data like shutter speed and aperture on a magnetic strip.'
});

loadModel('./models/starflash.glb', 3, [5.5, 1.75, -1], Math.PI + 0.7, {
    name: 'Kodak Brownie Starflash',
    year: '1957',
    description: 'The Brownie Starflash was the first Kodak camera to feature an integrated, built-in flash holder, rather than a separate flash unit that had to be attached. While it had a built-in flash holder, it still used M-2 flashbulbs, which were single-use and had to be changed after each shot. This model also came in four different colours: black, red, grey, and blue.'
});

loadModel('./models/tele-instamatic.glb', 3, [4.6, 1.9, -1.35], Math.PI + 0.2, {
    name: 'Kodak Tele-Instamatic 608',
    year: '1975',
    description: 'The Tele-Instamatic is known as both a “pocket camera” and “dual camera” due to its built-in, switchable normal and telephoto lenses. A sliding switch on the top instantly allowed the photographer to switch between a normal 25mm lens and 43mm telephoto lens. This camera is also unique in that it does not require batteries. Instead, it is entirely mechanical and uses a flipflash connector for flash photography.'
});

loadModel('./models/canonEOS.glb', 3, [3.5, 1.8, -1.35], 0.5, {
    name: 'Canon EOS 4000D',
    year: '2018',
    description: 'The EOS 4000D is the only DSLR camera in my collection. Unlike most modern DSLR cameras, it features a plastic lens mount rather than a metal lens mount to make the camera both budget-friendly and extremely lightweight. This camera also uses an 18-megapixel sensor and a DIGIC 4+ processor, which is technology that dates back approximately a decade before the camera was released.'
});

loadModel('./models/brownieFiesta.glb', 3, [-3.5, 1.8, -1.35], Math.PI - 0.5, {
    name: 'Kodak Brownie Fiesta',
    year: '1962',
    description: 'The Fiesta was marketed in such a way to make photography feel like a party, hence the name Fiesta. It was known for its packaging, which featured a yellow box with colourful suns on it. It was also known for its single shutter speed and fixed aperture, which made a distinct springy noise when shot. Unlike most other Brownie models that had leather coverings, the Fiesta had a plastic covering over the entire front of the body.'
});

loadModel('./models/polaroidSun.glb', 3, [-4.8, 1.75, -1.2], Math.PI - 0.6, {
    name: 'Polaroid Sun 600 LMS',
    year: '1983',
    description: 'The Polaroid Sun had an Light Management System (LMS) that would use infrared sensors to adjust exposure. This would sometimes produce interesting results, such as darkening indoor shots that contained plants due to how they interact with infrared light. The LMS could be controlled via a slider on the camera itself. Aside from the rare case of objects interacting with the infrared light, the Sun 600 was praised for being able to shoot in almost any conditions because of its infrared sensors.'
});

loadModel('./models/brownie1A.glb', 3, [-5.4, 1.75, -1], Math.PI - 0.3, {
    name: 'Kodak Brownie No. 2A',
    year: '1909',
    description: 'The 2A produced large postcard size negatives, allowing amateur photographers to create their own custom postcards. This actually significantly disrupted the commercial postcard business in some areas! Since the shutter was relatively simple, stiff, and slow, people often had to press the camera up against their bodies to prevent pictures from turning out blurry.'
});

loadModel('./models/instamaticM22.glb', 3, [-6, 1.7, -1.2], Math.PI - 0.7, {
    name: 'Kodak Instamatic Movie Camera',
    year: '1970',
    description: 'The M22 featured a special key to disengage a daylight filter when using tungsten-balance film indoors, preventing an unwanted orange tint in movies. The M22 also featured a DC micromotor powered by batteries, removing the need for manual spring-wound motors, which was a significant step forward in camera technology at the time. Aside from the technical features, it also included a fold-down grip to make it easier to hold and stabilize.'
});

loadModel('./models/instamaticX-15.glb', 3, [6, 0.65, -1], Math.PI + 0.7, {
    name: 'Kodak Instamatic X-15',
    year: '1970',
    description: 'The X-15 was a part of the X series, known for using specialized flash technology. The X-15 specifically used magicubes, which were fired by a mechanical striker pin rather than electricity. This meant the X-15 did not require batteries to operate. The later model in the X series, the X-15F, replaced the magicube with a flipflash system, which used battery-powered, vertical flash sticks that you turned over once the first set of bulbs was used.'
});

loadModel('./models/advantixF600.glb', 3, [5.3, 0.75, -1.2], Math.PI + 0.5, {
    name: 'Kodak ADVANTiX F600',
    year: '1999',
    description: 'The F600 uses APS film, requires one CR2 battery, has a zoom lens, built-in date feature, automatic flash, and a self-timer function. While this sounds great, APS film has been discontinued since 2011, so all existing APS film is expired and difficult to develop. The F600 used APS film because it allowed for three different photo formats, which could be switched via a slider on the camera itself. The three different formats were Classic (C), High Definition (H), and Panoramic (P).'
});

loadModel('./models/polaroidJoycam.glb', 3, [4.7, 0.7, -1.2], Math.PI + 0.7, {
    name: 'Polaroid JoyCam',
    year: '1999',
    description: 'The JoyCam featured a manual rip cord film ejection system rather than a motorized one. Essentially, instead of the camera automatically spitting out the photo, the photographer would have to pull a plastic ring on the side of the camera to extract the exposed film and allow it to develop.'
});

loadModel('./models/instaxMini.glb', 3, [3.5, 0.7, -1.35], Math.PI + 0.3, {
    name: 'Fujifilm Instax Mini 7+',
    year: '2020',
    description: 'The Instax Mini 7+ is a popular re-release of the 2004 Instax Mini 7, with a few enhancements to give that same late 90s to early 2000s feel. The Mini 7+ includes an automatic flash to ensure that every picture has adequate lighting. It also has a unique method for turning it on. Instead of flipping a switch or pressing a button, you pull the front lens out until it clicks into place and turns on. Once a picture is taken, it only takes about 90 seconds for the film to fully develop. Contrary to popular belief, developing pictures should not be shaken as it can cause uneven colours or blurriness from disrupting the chemical development process!'
});

loadModel('./models/brownieHawkeyeC.glb', 3.5, [-4.8, 0.7, -1.2], Math.PI - 0.6, {
    name: 'Kodak No. 2 Hawkeye Model C',
    year: '1913',
    description: 'The Hawkeye C was originally not a Kodak design. It was originally a Boston Camera Company design, which was bought by the Blair Camera Company in 1890, and later bought by Eastman Kodak in 1899. These leatherette-covered cardboard cameras were reissued in 1930 to celebrate Kodak’s 50th anniversary, during which the company gave away approximately 550,000 cameras to children turning 12 that year.'
});

loadModel('./models/diana.glb', 3, [-5.4, 0.7, -1.2], Math.PI - 0.3, {
    name: 'Diana No. 151',
    year: '1960s',
    description: 'The Diana 151 was considered a toy camera, with it being entirely plastic, relatively flimsy, and cheap. The lens is a simple plastic meniscus, making the corners of images noticeably blur. Users often had issues with light leaking in due the the flimsy design of the back latch. The 151 was often won as a children’s prize at fairs.'
});

loadModel('./models/konica.glb', 3, [-5.8, 0.7, -1.4], Math.PI - 0.9, {
    name: 'Konica Z-Up 110 VP',
    year: '1998',
    description: 'The Konica Z-Up was in the very last generation of film cameras before digital photography became widespread. It featured fully automatic exposure and autofocus to make it ideal for beginners. It only requires a single lithium battery and 35mm film, which are both still in production, so this camera is still easily usable.'
});

loadModel('./models/starmiteII.glb', 3, [-3.5, 0.7, -1.35], Math.PI - 0.5, {
    name: 'Kodak Brownie Starmite II',
    year: '1962',
    description: 'The Starmite II was a relatively simple yet popular camera of the 60s. One of its key features is its built-in flash socket, which was revolutionary at the time because most cameras required attaching a separate flashgun. The Starmite II was a part of Kodak’s Star series, which also includes another camera in my collection, the Starflash. Over 10 million cameras in the Star series were made between 1957 and the late 1960s.'
});

loadModel('./models/disc6000.glb', 3, [5.8, 3.7, -1.4], Math.PI + 0.7, {
    name: 'Kodak Disc 6000',
    year: '1982',
    description: 'The Kodak Disc 6000 was designed to to look like the “future of photography” and aimed to be an easy to use, pocket-sized camera. The Disc 6000 was also marketed for its fast flash, being capable of firing again in 1.3 seconds. The name of this camera comes from its film type. Rather than using a roll of film, it used a circular plastic disc that held 15 tiny 10mm x 8mm negatives. Unfortunately, this camera was a flop because the small negatives resulted in low-quality grainy photos.'
});

loadModel('./models/flash20.glb', 3, [-5.8, 3.7, -1.4], Math.PI + 1.1, {
    name: 'Kodak Brownie Flash 20',
    year: '1959',
    description: 'The Flash 20 was advanced for its time in terms of point-and-shoot cameras. It offered three apertures for different lighting conditions, zone focusing, built-in flash, and an interlocked shutter to prevent double exposures. Most notably, it has a molded blue plastic body making it very lightweight.'
});


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

//handles clicking on a camera to zoom in on it
window.addEventListener('click', () => {
    if (!hoveredObject || lookingAtObject || isZooming || introOpen) return; //do nothing if there's no hovered object or if we're already looking at an object

    lookingAtObject = true; //set lookingAtObject to true to prevent zooming in on another object while already zoomed in
    
    //calculate the center of the hovered object for camera targeting
    const box = new THREE.Box3().setFromObject(hoveredObject);
    const center = new THREE.Vector3();
    box.getCenter(center);

    //offset the look target slightly to the left to allow space for a pop-up on the right
    const offset = new THREE.Vector3(-0.45, 0, 0);
    lookTarget.copy(center).add(offset);

    //calculate the target camera position by moving back from the center along the camera's current direction
    const direction = new THREE.Vector3()
        .subVectors(camera.position, center)
        .normalize();

    //set the target position a fixed distance from the center in the direction away from the camera
    const distance = 0.75;
    targetPosition.copy(center).add(direction.multiplyScalar(distance));

    //set the title, year, and description
    popupContent.innerHTML = `
        <h2>${hoveredObject.userData.name}</h2>
        <p>${hoveredObject.userData.year}</p>
        <p>${hoveredObject.userData.description}</p>
    `;

    isZooming = true;
});


//handles closing the object popup and returning the camera to its original position
closeButton.addEventListener('click', () => {
    targetPosition.copy(origCameraPos);
    lookTarget.copy(origLookTarget);
    lookingAtObject = false;
    isZooming = true;
});


// HIGHLIGHT FUNCTION

//applies an emissive highlight to the hovered object and its children to ensure the whole object is highlighted
function setHighlight(object, on) {
    object.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
            if (on && !lookingAtObject && !introOpen) {
                child.material.emissive.set(0x333333);
            } else {
                child.material.emissive.set(0x000000);
            }
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

    if (isZooming) {
        //move camera smoothly toward the target position
        camera.position.lerp(targetPosition, 0.05);

        //force the camera to look at the look target while zooming in by interpolating the camera's current look direction
        const currentLook = new THREE.Vector3();
        camera.getWorldDirection(currentLook);

        const desiredDir = new THREE.Vector3()
            .subVectors(lookTarget, camera.position)
            .normalize();

        currentLook.lerp(desiredDir, 0.05);

        const newLookAt = new THREE.Vector3()
            .addVectors(camera.position, currentLook);

        camera.lookAt(newLookAt);

        //if the camera is close enough to the target position, stop zooming
        if (camera.position.distanceTo(targetPosition) < 0.05) {
            isZooming = false;
        }
    }

    //show the camera popup if we are looking at an object but are not actively zooming in
    if(lookingAtObject && !isZooming) {
        cameraPopup.classList.add('show');
        closeButton.classList.add('show');
    } else {
        cameraPopup.classList.remove('show');
        closeButton.classList.remove('show');
    }
    renderer.render(scene, camera);
}
animate();