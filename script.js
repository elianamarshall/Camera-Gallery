import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const scene = new THREE.Scene();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2, -2); //starts off-screen so nothing is hovered before the first pointer move
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
const interactableMeshes = []; //flat list of meshes for raycasting -- flat avoids re-traversing the hierarchy every test

const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

//scratch vectors, reused every frame so the zoom animation allocates nothing
const scratchDir = new THREE.Vector3();

//the zoom runs on a clock rather than a per-frame lerp, so it always takes the
//same wall-clock time no matter how fast the browser is drawing this scene
const ZOOM_DURATION = 700; //ms
let zoomStart = 0;
const zoomStartPos = new THREE.Vector3();
const zoomStartQuat = new THREE.Quaternion();
const zoomEndQuat = new THREE.Quaternion();
//used to derive the end orientation from lookTarget. It has to be a Camera, not
//a plain Object3D: lookAt aims +Z at the target for ordinary objects but -Z for
//cameras, so an Object3D here would face the wrong way down the same axis.
const orientationHelper = new THREE.Camera();

let needsRender = true; //the scene is static, so we only redraw when something actually changed
let pointerMoved = false; //raycast only after the pointer has moved, not on every frame
let popupVisible = false; //mirrors the popup's CSS state so we don't touch the DOM 60x a second


// CAMERA

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.y = Math.PI;
camera.position.copy(origCameraPos);
camera.rotation.x = 0.2;


// RENDERER

const renderer = new THREE.WebGLRenderer({
    antialias: false, //turn anti aliasing off for better performance
    powerPreference: 'high-performance', //ask for the discrete GPU on dual-GPU laptops
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); //cap the resolution for better performance
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();


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

//models ship as KTX2/Basis textures and Meshopt-compressed geometry, so the
//loader needs both decoders wired up before it can read them
const ktx2Loader = new KTX2Loader()
    .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
    .detectSupport(renderer);

const loader = new GLTFLoader()
    .setPath(`${import.meta.env.BASE_URL}models/`)
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder);

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

            const material = child.material;
            if (material) {
                // ensure emissive exists
                if (material.emissive) {
                    material.emissive.set(0x000000);
                }

                //keep textures sharp on surfaces viewed at an angle; costs nothing
                //now that every texture ships with a full mipmap chain
                for (const key of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'emissiveMap']) {
                    if (material[key]) {
                        material[key].anisotropy = Math.min(4, maxAnisotropy);
                    }
                }
            }
        }
    });
    //freeze root transform
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
}


// LOADER FUNCTION & LOADING SCREEN

//updates the loading screen as models arrive, and fades it out when they're all in
function updateLoadingScreen(loaded, total) {
    const progress = Math.floor((loaded / total) * 100);
    loadingText.textContent = `Loading... ${progress}%`;
}

//reveals the intro pop-up once the gallery is ready
function showIntro() {
    const introPopup = document.getElementById('intro-popup');
    const introButton = document.getElementById('intro-button');

    introPopup.classList.add('show');
    introButton.classList.add('show');

    introButton.addEventListener('click', () => {
        introPopup.classList.remove('show');
        introButton.classList.remove('show');
        introOpen = false;
    }, { once: true });
}

function hideLoadingScreen() {
    loadingScreen.style.transition = 'opacity 1s ease';
    loadingScreen.style.opacity = 0;

    setTimeout(() => {
        loadingScreen.style.display = 'none';
        showIntro();
    }, 1000);
}

//loads one model with optimizations and adds it to the scene, plus the
//interactable list when it carries camera info
async function loadModel({ path, scale, pos, rot, info }) {
    const gltf = await loader.loadAsync(path);
    const obj = gltf.scene;

    if (info) {
        obj.scale.set(scale, scale, scale);
        obj.position.set(...pos);
        obj.rotation.y = rot;
        obj.userData = info;
    }

    optimizeModel(obj);
    scene.add(obj);

    if (info) {
        //cache each model's centre now instead of recomputing a bounding box on
        //every click, which had to walk the geometry each time
        const box = new THREE.Box3().setFromObject(obj);
        obj.userData.center = box.getCenter(new THREE.Vector3());

        obj.traverse((child) => {
            if (child.isMesh) {
                child.userData.root = obj; //lets a raycast hit jump straight to the model root
                interactableMeshes.push(child);
            }
        });
    }

    needsRender = true;
}


// MODELS

//the room itself; loaded first so the gallery has context as cameras pop in
const ROOM = { path: 'scene.glb' };

const CAMERAS = [
    {
        path: 'brownieE.glb', scale: 3, pos: [6.1, 2.8, -1], rot: Math.PI + 0.7, info: {
            name: 'Kodak No. 2 Brownie Box Model E',
            year: '1920',
            description: 'This camera model was widely popular due to its affordability and durability. It was the first camera to introduce a metal body rather than wood, making it sturdier than most other cameras. It was just $1.00 when it was released, which is approximately equivalent to $16.34 in 2026. It was also the first camera to use 120 film!'
        }
    },
    {
        path: 'agfaAnsco.glb', scale: 3, pos: [5.5, 2.8, -1], rot: Math.PI + 0.8, info: {
            name: `Agfa Ansco No. 1 Readyset Royal Folding Camera`,
            year: '1931',
            description: 'This camera is quite peculiar in that it functions like a box camera, but folds out. Traditionally, folding cameras offered portability and advanced manual controls, while box cameras were considered “point-and-shoot” cameras. The Readyset was designed to be both portable and simple, so it was collapsible but also considered a “point-and-shoot” camera. '
        }
    },
    {
        path: 'polaroidLand.glb', scale: 3, pos: [4.6, 2.8, -1.2], rot: Math.PI + 0.7, info: {
            name: 'Polaroid Spirit',
            year: '1982',
            description: 'This camera line is unique in that the battery that powers the camera is built into the film pack itself, not the camera body. This meant that every time you bought new film, you also got a new battery! The Spirit was also the first Polaroid camera to use a new and improved film that developed 4x faster than the film used by previous Polaroid models.'
        }
    },
    {
        path: 'hawkeyeInstamatic.glb', scale: 3, pos: [3.6, 2.85, -1.2], rot: Math.PI + 0.7, info: {
            name: 'Kodak Hawkeye Instamatic R4',
            year: '1965',
            description: 'The Hawkeye Instamatic R4 is best known for its distinctive green and silver design. It was also a part of the line of cameras that introduced the 126 cartridge film, which eliminated the need to thread film. Additionally, it was designed to use 4-bulb flashcubes that rotated automatically after each shot, allowing four shots before needing to change the flash. Unlike flash nowadays, they used to only be single-use because they relied on a physical chemical reaction to ignite the bulb, which would instantly burn out in an intense flash.'
        }
    },
    {
        path: 'fujifilmDL.glb', scale: 3, pos: [-3.6, 2.85, -1.2], rot: Math.PI - 0.3, info: {
            name: 'Fujifilm DL-270 Zoom Super',
            year: '1994',
            description: 'This camera uniquely uses a “prewind” system for film loading, which is a reverse-counting mechanism. Essentially, when you load a new roll of film, the camera instantly winds the entire roll onto the take-up spool and counts down to 0 as you take pictures. This ensures that if the backing is accidentally opened, the pictures already taken are protected from light inside of the cassette.'
        }
    },
    {
        path: 'automaticBrownie.glb', scale: 3, pos: [-4.7, 2.85, -1.2], rot: Math.PI - 0.3, info: {
            name: 'Kodak No. 3A Folding Brownie',
            year: '1909',
            description: 'The 3A Folding Brownie was the first in the Brownie series designed to create postcard sized photos, making it easy to send photos through the mail. It used 122 film to achieve this postcard formatting. It was also visually set apart from other Brownie cameras as it features red bellows rather than the standard black.'
        }
    },
    {
        path: 'brownieHawkeyeFlash.glb', scale: 3, pos: [-5.6, 2.8, -1], rot: Math.PI - 0.3, info: {
            name: 'Kodak Brownie Hawkeye Flash',
            year: '1950',
            description: 'The Brownie Hawkeye Flash is recognized as one of the most popular Brownie cameras made–and there were a lot of them! It’s easy to use and comes apart very easily to clean the lens and viewfinder. Most Hawkeye Flash’s will also accept 120 film without respooling it onto a 620 spool, even though the camera was designed for a 620 spool. This is very useful because 620 film was discontinued in 1995, but 120 film is still widely used!'
        }
    },
    {
        path: 'browniePremo.glb', scale: 3, pos: [-6.1, 2.8, -1], rot: Math.PI - 0.4, info: {
            name: 'Kodak Premo Junior',
            year: '1908',
            description: 'The Premo Junior was designed to be a very simple and affordable box camera for amateurs, and was notably marketed towards children. Unlike most other Brownie cameras of that time, the Premo Junior used a 12-exposure Premo Film Pack to allow photographers to remove and develop individual exposures before the entire pack was finished. The film packs also used paper tabs to change exposures.'
        }
    },
    {
        path: 'advantixT70.glb', scale: 3, pos: [6.1, 1.75, -1], rot: -1.8, info: {
            name: 'Kodak ADVANTiX T70',
            year: '1998',
            description: 'The ADVANTiX T70 features a safety interlock system, which only allows the film door to open after the film has been completely rewound into the cassette. This is designed to prevent accidental exposure of the film. The T70 also included three different built-in aspect ratios for photos: Classic (C), High Definition (H), and Panorama (P). Additionally, the T70 had an automatic memory system, which would record data like shutter speed and aperture on a magnetic strip.'
        }
    },
    {
        path: 'starflash.glb', scale: 3, pos: [5.5, 1.75, -1], rot: Math.PI + 0.7, info: {
            name: 'Kodak Brownie Starflash',
            year: '1957',
            description: 'The Brownie Starflash was the first Kodak camera to feature an integrated, built-in flash holder, rather than a separate flash unit that had to be attached. While it had a built-in flash holder, it still used M-2 flashbulbs, which were single-use and had to be changed after each shot. This model also came in four different colours: black, red, grey, and blue.'
        }
    },
    {
        path: 'tele-instamatic.glb', scale: 3, pos: [4.6, 1.9, -1.35], rot: Math.PI + 0.2, info: {
            name: 'Kodak Tele-Instamatic 608',
            year: '1975',
            description: 'The Tele-Instamatic is known as both a “pocket camera” and “dual camera” due to its built-in, switchable normal and telephoto lenses. A sliding switch on the top instantly allowed the photographer to switch between a normal 25mm lens and 43mm telephoto lens. This camera is also unique in that it does not require batteries. Instead, it is entirely mechanical and uses a flipflash connector for flash photography.'
        }
    },
    {
        path: 'canonEOS.glb', scale: 3, pos: [3.5, 1.8, -1.35], rot: 0.5, info: {
            name: 'Canon EOS 4000D',
            year: '2018',
            description: 'The EOS 4000D is the only DSLR camera in my collection. Unlike most modern DSLR cameras, it features a plastic lens mount rather than a metal lens mount to make the camera both budget-friendly and extremely lightweight. This camera also uses an 18-megapixel sensor and a DIGIC 4+ processor, which is technology that dates back approximately a decade before the camera was released.'
        }
    },
    {
        path: 'brownieFiesta.glb', scale: 3, pos: [-3.5, 1.8, -1.35], rot: Math.PI - 0.5, info: {
            name: 'Kodak Brownie Fiesta',
            year: '1962',
            description: 'The Fiesta was marketed in such a way to make photography feel like a party, hence the name Fiesta. It was known for its packaging, which featured a yellow box with colourful suns on it. It was also known for its single shutter speed and fixed aperture, which made a distinct springy noise when shot. Unlike most other Brownie models that had leather coverings, the Fiesta had a plastic covering over the entire front of the body.'
        }
    },
    {
        path: 'polaroidSun.glb', scale: 3, pos: [-4.8, 1.75, -1.2], rot: Math.PI - 0.6, info: {
            name: 'Polaroid Sun 600 LMS',
            year: '1983',
            description: 'The Polaroid Sun had an Light Management System (LMS) that would use infrared sensors to adjust exposure. This would sometimes produce interesting results, such as darkening indoor shots that contained plants due to how they interact with infrared light. The LMS could be controlled via a slider on the camera itself. Aside from the rare case of objects interacting with the infrared light, the Sun 600 was praised for being able to shoot in almost any conditions because of its infrared sensors.'
        }
    },
    {
        path: 'brownie1A.glb', scale: 3, pos: [-5.4, 1.75, -1], rot: Math.PI - 0.3, info: {
            name: 'Kodak Brownie No. 2A',
            year: '1909',
            description: 'The 2A produced large postcard size negatives, allowing amateur photographers to create their own custom postcards. This actually significantly disrupted the commercial postcard business in some areas! Since the shutter was relatively simple, stiff, and slow, people often had to press the camera up against their bodies to prevent pictures from turning out blurry.'
        }
    },
    {
        path: 'instamaticM22.glb', scale: 3, pos: [-6, 1.7, -1.2], rot: Math.PI - 0.7, info: {
            name: 'Kodak Instamatic Movie Camera',
            year: '1970',
            description: 'The M22 featured a special key to disengage a daylight filter when using tungsten-balance film indoors, preventing an unwanted orange tint in movies. The M22 also featured a DC micromotor powered by batteries, removing the need for manual spring-wound motors, which was a significant step forward in camera technology at the time. Aside from the technical features, it also included a fold-down grip to make it easier to hold and stabilize.'
        }
    },
    {
        path: 'instamaticX-15.glb', scale: 3, pos: [6, 0.65, -1], rot: Math.PI + 0.7, info: {
            name: 'Kodak Instamatic X-15',
            year: '1970',
            description: 'The X-15 was a part of the X series, known for using specialized flash technology. The X-15 specifically used magicubes, which were fired by a mechanical striker pin rather than electricity. This meant the X-15 did not require batteries to operate. The later model in the X series, the X-15F, replaced the magicube with a flipflash system, which used battery-powered, vertical flash sticks that you turned over once the first set of bulbs was used.'
        }
    },
    {
        path: 'advantixF600.glb', scale: 3, pos: [5.3, 0.75, -1.2], rot: Math.PI + 0.5, info: {
            name: 'Kodak ADVANTiX F600',
            year: '1999',
            description: 'The F600 uses APS film, requires one CR2 battery, has a zoom lens, built-in date feature, automatic flash, and a self-timer function. While this sounds great, APS film has been discontinued since 2011, so all existing APS film is expired and difficult to develop. The F600 used APS film because it allowed for three different photo formats, which could be switched via a slider on the camera itself. The three different formats were Classic (C), High Definition (H), and Panoramic (P).'
        }
    },
    {
        path: 'polaroidJoycam.glb', scale: 3, pos: [4.7, 0.7, -1.2], rot: Math.PI + 0.7, info: {
            name: 'Polaroid JoyCam',
            year: '1999',
            description: 'The JoyCam featured a manual rip cord film ejection system rather than a motorized one. Essentially, instead of the camera automatically spitting out the photo, the photographer would have to pull a plastic ring on the side of the camera to extract the exposed film and allow it to develop.'
        }
    },
    {
        path: 'instaxMini.glb', scale: 3, pos: [3.5, 0.7, -1.35], rot: Math.PI + 0.3, info: {
            name: 'Fujifilm Instax Mini 7+',
            year: '2020',
            description: 'The Instax Mini 7+ is a popular re-release of the 2004 Instax Mini 7, with a few enhancements to give that same late 90s to early 2000s feel. The Mini 7+ includes an automatic flash to ensure that every picture has adequate lighting. It also has a unique method for turning it on. Instead of flipping a switch or pressing a button, you pull the front lens out until it clicks into place and turns on. Once a picture is taken, it only takes about 90 seconds for the film to fully develop. Contrary to popular belief, developing pictures should not be shaken as it can cause uneven colours or blurriness from disrupting the chemical development process!'
        }
    },
    {
        path: 'brownieHawkeyeC.glb', scale: 3.5, pos: [-4.8, 0.7, -1.2], rot: Math.PI - 0.6, info: {
            name: 'Kodak No. 2 Hawkeye Model C',
            year: '1913',
            description: 'The Hawkeye C was originally not a Kodak design. It was originally a Boston Camera Company design, which was bought by the Blair Camera Company in 1890, and later bought by Eastman Kodak in 1899. These leatherette-covered cardboard cameras were reissued in 1930 to celebrate Kodak’s 50th anniversary, during which the company gave away approximately 550,000 cameras to children turning 12 that year.'
        }
    },
    {
        path: 'diana.glb', scale: 3, pos: [-5.4, 0.7, -1.2], rot: Math.PI - 0.3, info: {
            name: 'Diana No. 151',
            year: '1960s',
            description: 'The Diana 151 was considered a toy camera, with it being entirely plastic, relatively flimsy, and cheap. The lens is a simple plastic meniscus, making the corners of images noticeably blur. Users often had issues with light leaking in due the the flimsy design of the back latch. The 151 was often won as a children’s prize at fairs.'
        }
    },
    {
        path: 'konica.glb', scale: 3, pos: [-5.8, 0.7, -1.4], rot: Math.PI - 0.9, info: {
            name: 'Konica Z-Up 110 VP',
            year: '1998',
            description: 'The Konica Z-Up was in the very last generation of film cameras before digital photography became widespread. It featured fully automatic exposure and autofocus to make it ideal for beginners. It only requires a single lithium battery and 35mm film, which are both still in production, so this camera is still easily usable.'
        }
    },
    {
        path: 'starmiteII.glb', scale: 3, pos: [-3.5, 0.7, -1.35], rot: Math.PI - 0.5, info: {
            name: 'Kodak Brownie Starmite II',
            year: '1962',
            description: 'The Starmite II was a relatively simple yet popular camera of the 60s. One of its key features is its built-in flash socket, which was revolutionary at the time because most cameras required attaching a separate flashgun. The Starmite II was a part of Kodak’s Star series, which also includes another camera in my collection, the Starflash. Over 10 million cameras in the Star series were made between 1957 and the late 1960s.'
        }
    },
    {
        path: 'disc6000.glb', scale: 3, pos: [5.8, 3.7, -1.4], rot: Math.PI + 0.7, info: {
            name: 'Kodak Disc 6000',
            year: '1982',
            description: 'The Kodak Disc 6000 was designed to to look like the “future of photography” and aimed to be an easy to use, pocket-sized camera. The Disc 6000 was also marketed for its fast flash, being capable of firing again in 1.3 seconds. The name of this camera comes from its film type. Rather than using a roll of film, it used a circular plastic disc that held 15 tiny 10mm x 8mm negatives. Unfortunately, this camera was a flop because the small negatives resulted in low-quality grainy photos.'
        }
    },
    {
        path: 'flash20.glb', scale: 3, pos: [-5.8, 3.7, -1.4], rot: Math.PI - 1, info: {
            name: 'Kodak Brownie Flash 20',
            year: '1959',
            description: 'The Flash 20 was advanced for its time in terms of point-and-shoot cameras. It offered three apertures for different lighting conditions, zone focusing, built-in flash, and an interlocked shutter to prevent double exposures. Most notably, it has a molded blue plastic body making it very lightweight.'
        }
    },
    {
        path: 'advantixC400.glb', scale: 3, pos: [4.7, 3.6, -1.35], rot: Math.PI + 0.3, info: {
            name: 'Kodak Advantix C400',
            year: '2000',
            description: 'The Advantix C400 was a compact, fully automatic point-and-shoot camera that used the discontinued Advanced Photo System (APS) film. It featured a distinctive flip-up lens cover that was designed to both protect the lens and house the built-in flash. Interestingly, the flip-up flash placement creates extra distance between the flash and the lens, naturally reducing red-eye in photos.'
        }
    },
    {
        path: 'automatic8.glb', scale: 3, pos: [2.4, 3.55, -1.35], rot: Math.PI + 0.7, info: {
            name: 'Kodak Automatic 8 Movie Camera',
            year: '1962',
            description: 'Back in 1962, the Automatic 8 was introduced as a budget-friendly, foolproof home movie camera that used an “electric eye” to eliminate manual settings. The “electric eye” was a built-in selenium photocell light meter that automatically and continuously adjusted the aperture as you filmed. This meant that you didn’t have to adjust any exposure settings during filming. Despite having the automatic light meter, the camera itself did not have batteries because it instead relied on a spring-wound clockwork motor. That means it’s a wind-up camera!'
        }
    },
    {
        path: 'powerShotS1.glb', scale: 3, pos: [-3.5, 3.65, -1.4], rot: Math.PI - 0.3, info: {
            name: 'Canon PowerShot S1 IS',
            year: '2004',
            description: 'The PowerShot S1 IS was truly groundbreaking for its time. It had the world’s first lens-based Ultrasonic Motor (USM), which allowed for both fast and extremely quiet zooming. This was an ideal camera for wildlife photographers since the quiet zooming allowed for pictures to be taken without scaring animals away. The “IS” in the name stands for Image Stabilizer, which combats blur at the far end of its zoom capabilities to keep far off images crisp and clean.'
        }
    },
    {
        path: 'squareShooter2.glb', scale: 3.5, pos: [-4.8, 3.7, -1.2], rot: Math.PI - 0.6, info: {
            name: 'Polaroid Square Shooter 2',
            year: '1972',
            description: 'The Square Shooter 2 uses Type 88 peel-apart packfilm, which has unfortunately been discontinued for years, making it difficult to use this camera as the film is extremely rare. Aside from the unique film, it has a handy sliding card in the back with instructions on how to use the camera, which was uncommon since cameras generally came with a small handbook. Additionally, it used an “Everset” shutter mechanism, meaning the shutter did not need to be manually cocked or reset before taking a photo.'
        }
    },
    {
        path: 'vivitar.glb', scale: 3, pos: [3.5, 3.73, -1.35], rot: Math.PI + 0.3, info: {
            name: 'Vivitar Tele-835AW',
            year: '1979',
            description: 'This Vivitar was a vintage pocket camera that featured a motorized auto-wind mechanism, which is what the AW stands for. Unlike most other pocket cameras that used 110 film cartridges, the auto-wind feature meant that it no longer required a manual thumb wheel or level to advance the film. Another neat feature of this camera is its EX button. When using the flash at close range, pressing the EX button would put a grey filter in front of the lens to prevent the subject’s face from being overexposed.'
        }
    },
];


// LOADING

async function loadAll() {
    const queue = [ROOM, ...CAMERAS];
    const total = queue.length;
    let loaded = 0;

    updateLoadingScreen(0, total);

    async function worker() {
        let item;
        while ((item = queue.shift())) {
            try {
                await loadModel(item);
            } catch (error) {
                console.error(`Failed to load ${item.path}`, error);
            }
            loaded++;
            updateLoadingScreen(loaded, total);
        }
    }

    await Promise.all(Array.from({ length: 6 }, worker));

    //every transform is final now, so three can stop walking the whole
    //hierarchy each frame
    scene.updateMatrixWorld(true);
    scene.matrixWorldAutoUpdate = false;

    ktx2Loader.dispose(); //frees the transcoder worker pool

    hideLoadingScreen();
}

loadAll();


// EVENTS

//handles window resizing, debounced so a drag doesn't reallocate buffers on every event
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(window.innerWidth, window.innerHeight);
        needsRender = true;
    }, 100);
});

function updatePointer(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    pointerMoved = true;
}

//handles mouse movement and updates the pointer vector for raycasting
window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return; //touch has no hover; taps are handled below
    updatePointer(event.clientX, event.clientY);
});

//captures where the camera is now and where it needs to end up, then starts the clock
function startZoom() {
    zoomStartPos.copy(camera.position);
    zoomStartQuat.copy(camera.quaternion);

    orientationHelper.position.copy(targetPosition);
    orientationHelper.up.copy(camera.up);
    orientationHelper.lookAt(lookTarget);
    zoomEndQuat.copy(orientationHelper.quaternion);

    zoomStart = performance.now();
    isZooming = true;
}

//zooms in on whichever camera is under the pointer
function selectAtPointer() {
    if (lookingAtObject || isZooming || introOpen) return; //do nothing if we're already looking at an object

    const hit = raycast();
    if (!hit) return;

    lookingAtObject = true; //set lookingAtObject to true to prevent zooming in on another object while already zoomed in

    //the centre was measured once at load time
    const center = hit.userData.center;

    //offset the look target slightly to the left to allow space for a pop-up on the right
    lookTarget.set(center.x - 0.45, center.y, center.z);

    //calculate the target camera position by moving back from the center along the camera's current direction
    scratchDir.subVectors(camera.position, center).normalize();

    //set the target position a fixed distance from the center in the direction away from the camera
    const distance = 0.75;
    targetPosition.copy(center).addScaledVector(scratchDir, distance);

    //set the title, year, and description
    popupContent.innerHTML = `
        <h2>${hit.userData.name}</h2>
        <p>${hit.userData.year}</p>
        <p>${hit.userData.description}</p>
    `;

    startZoom();
    setHighlight(hit, false); //clear the hover glow now that we're zoomed in
    pointerMoved = true; //lets updateHover drop the stale hover state and cursor
}

//a tap or click on the canvas selects a camera. Listening on the canvas rather
//than the window means the pop-ups no longer have to race the same event, and
//tapping works on touch devices, which never fire a hover.
let pressStart = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
    pressStart = { x: event.clientX, y: event.clientY, time: performance.now() };
});

renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pressStart) return;
    const dragged = Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10;
    const held = performance.now() - pressStart.time > 500;
    pressStart = null;
    if (dragged || held) return; //a drag or long press isn't a tap

    updatePointer(event.clientX, event.clientY);
    selectAtPointer();
});

renderer.domElement.addEventListener('pointercancel', () => {
    pressStart = null;
});

//handles closing the object popup and returning the camera to its original position
closeButton.addEventListener('click', () => {
    targetPosition.copy(origCameraPos);
    lookTarget.copy(origLookTarget);
    lookingAtObject = false;
    startZoom();
});

//stop drawing entirely while the tab is in the background
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopLoop();
    } else {
        needsRender = true;
        startLoop();
    }
});


// HIGHLIGHT FUNCTION

//applies an emissive highlight to the hovered object and its children to ensure the whole object is highlighted
function setHighlight(object, on) {
    const highlight = on && !lookingAtObject && !introOpen ? 0x333333 : 0x000000;
    object.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setHex(highlight);
        }
    });
    needsRender = true;
}


// HOVER

//returns the model root under the pointer, or null
function raycast() {
    raycaster.setFromCamera(pointer, camera);
    //a flat, non-recursive list means three tests each mesh's bounding volume
    //directly instead of re-walking 27 object hierarchies
    const intersects = raycaster.intersectObjects(interactableMeshes, false);
    return intersects.length > 0 ? intersects[0].object.userData.root ?? null : null;
}

function updateHover() {
    //highlighting is suppressed in these states anyway, so skip the raycast
    if (lookingAtObject || isZooming || introOpen) {
        if (hoveredObject) {
            setHighlight(hoveredObject, false);
            hoveredObject = null;
            renderer.domElement.style.cursor = '';
        }
        return;
    }

    const object = raycast();

    if (hoveredObject !== object) { //if the hovered object has changed, update the highlight
        if (hoveredObject) {
            setHighlight(hoveredObject, false);
        }
        hoveredObject = object;
        if (hoveredObject) {
            setHighlight(hoveredObject, true);
        }
        renderer.domElement.style.cursor = object ? 'pointer' : '';
    }
}


// ANIMATION

let frameId = null;

//a single guarded entry point -- without it, visibilitychange could start a
//second rAF chain and every frame would be rendered twice from then on
function startLoop() {
    if (frameId === null) frameId = requestAnimationFrame(tick);
}

function stopLoop() {
    if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
}

function tick() {
    frameId = requestAnimationFrame(tick);

    //raycasting walks real geometry, so only do it when the pointer actually moved
    if (pointerMoved) {
        pointerMoved = false;
        updateHover();
    }

    if (isZooming) {
        const t = Math.min((performance.now() - zoomStart) / ZOOM_DURATION, 1);
        const eased = t * t * (3 - 2 * t); //smoothstep: eases in and out, but actually reaches the target

        camera.position.lerpVectors(zoomStartPos, targetPosition, eased);
        camera.quaternion.slerpQuaternions(zoomStartQuat, zoomEndQuat, eased);

        needsRender = true;

        if (t === 1) {
            isZooming = false;
            pointerMoved = true; //re-check what's under the pointer now that we've settled
        }
    }

    //show the camera popup if we are looking at an object but are not actively zooming in
    const showPopup = lookingAtObject && !isZooming;
    if (showPopup !== popupVisible) { //only touch the DOM when the state actually flips
        popupVisible = showPopup;
        cameraPopup.classList.toggle('show', showPopup);
        closeButton.classList.toggle('show', showPopup);
    }

    //the scene is static: no animations, no orbiting camera. Redrawing an
    //unchanged image 60 times a second is pure waste, so only draw when
    //something moved.
    if (needsRender) {
        needsRender = false;
        renderer.render(scene, camera);
    }
}
startLoop();
