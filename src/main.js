/*  OBS: Baseado no código de https://github.com/mrdoob

https://github.com/mrdoob/three.js/blob/master/examples/games_fps.html
*/


import * as THREE from 'three'

import { GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

import { AudioManager } from './AudioManager.js';

import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { Player } from './Player.js';

import { Coin } from './Coin.js';

import { MovingPlatform } from "./MovingPlatform.js";


const timer = new THREE.Timer();
timer.connect(document);

/* Atributos de cena*/
const colorBg = 0x88ccee
const colorFog = 0x88ccee

const scene = new THREE.Scene();

const cubeTextureLoader = new THREE.CubeTextureLoader();


const skybox = cubeTextureLoader.load([
    '/skybox/gloomy_ft.png', // +Z
    '/skybox/gloomy_bk.png', // -Z
    '/skybox/gloomy_up.png', // +Y
    '/skybox/gloomy_dn.png', // -Y
    '/skybox/gloomy_rt.png', // +X
    '/skybox/gloomy_lf.png', // -X
]);

scene.background = skybox;


// COLOR, NEAR, FAR
//scene.fog = new THREE.Fog(colorFog, 0, 50);
   

/* Atributos de camera*/
// FOV, ASPECT RATIO, NEAR e FAR
const aspectRatio = (window.innerWidth / window.innerHeight);
const fov = 70;
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
camera.rotation.order = 'YXZ';

// Hemisphere Light
const skyColor = 0x8dc1de;
const groundColor = 0x4a7a9a;
const hlIntensity = 1.2;

const fillLight1 = new THREE.HemisphereLight(
    skyColor,
    groundColor,
    hlIntensity
);

scene.add(fillLight1);


// directional Light (luz principal do sol)
const dlColor = 0xffe0b3;
const dlIntesity = 1.3;

const directionalLight = new THREE.DirectionalLight(dlColor, dlIntesity);

directionalLight.position.set(10, 20, 10);

directionalLight.castShadow = true;


// sombras
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 120;

directionalLight.shadow.camera.right = 40;
directionalLight.shadow.camera.left = -40;
directionalLight.shadow.camera.top = 40;
directionalLight.shadow.camera.bottom = -40;

directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;

directionalLight.shadow.radius = 10;
directionalLight.shadow.bias = -0.0001;

scene.add(directionalLight);



const container = document.getElementById('container');

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild( renderer.domElement ); 



const GRAVITY = 30;
const NUM_SPHERES = 100;
const SPHERE_RADIUS= 0.2;
const STEPS_PER_FRAME = 5;

const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);

const sphereMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.55,
    transmission: 0.15,
    roughness: 0.15,
    metalness: 0
});

const spheres = [];
let sphereIdx = 0;

for (let i = 0; i < NUM_SPHERES; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    scene.add(sphere);

    spheres.push({
        mesh: sphere,
        collider: new THREE.Sphere(new THREE.Vector3(0,-100,0), SPHERE_RADIUS),
        velocity: new THREE.Vector3()
    });
}

// audio
const audio = new AudioManager(camera);

audio.loadMusic('/Music/lethal_lava_land.mp3');

audio.loadSound(
    "jump",
    "/Music/jump.mp3",
    0.5
);

audio.loadSound(
    "fireball",
    "/Music/fireball.mp3",
    0.6
);

audio.loadSound(
    "death",
    "/Music/death.mp3",
    0.6
);

audio.loadSound(
    "lava",
    "/Music/lava.mp3",
    0.6
);

audio.loadSound(
    "yeahoo",
    "/Music/yeahoo.mp3",
    0.6
);

audio.loadSound(
    "coin",
    "/Music/coin.mp3",
    0.6
);

// Coletáveis (8 RED COINS)

const coins = [];

const coinPositions = [
    new THREE.Vector3(47, 6, -58),
    new THREE.Vector3(40, 1, -38),
    new THREE.Vector3(31, 2, -64),
    new THREE.Vector3(90, 2, -62),
    new THREE.Vector3(119, 2, -91),
    new THREE.Vector3(66, 7, -119),
    new THREE.Vector3(12, 2, -119),
    new THREE.Vector3(90, 6, -25)
];

coinPositions.forEach(pos => {
    const coin = new Coin(scene, pos, '/models/gltf/collectables/coin.glb');
    coins.push(coin);
});

// Plataformas
const platforms = [];

platforms.push(

    new MovingPlatform(scene, {

        start: new THREE.Vector3(120,5,-25),
        end: new THREE.Vector3(100, 6, -25),
        size: new THREE.Vector3(6,1,6),

        speed: 10

    })

);

platforms.push(

    new MovingPlatform(scene, {

        start: new THREE.Vector3(122,1,-40),
        end: new THREE.Vector3(122,1,-15),

        size: new THREE.Vector3(8,1,8),

        speed: 10

    })

);

const worldOctree = new Octree();

// JOGADOR começa aqui
const PLAYER_START = {
    start: new THREE.Vector3(35,15,-15),
    end: new THREE.Vector3(35,15,-15)
}

// Toda a lógica do Mario (collider, velocity, camera, animação, input) está na classe Player
const player = new Player(scene, worldOctree, camera, {
    gravity: GRAVITY,
    startPosition: PLAYER_START,
    modelUrl: '/models/gltf/mario/source/mario64.glb',
    audio,
    platforms
});

let mouseTime = 0;
const aimDirection = new THREE.Vector3();

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

// MUSICA
container.addEventListener('mousedown', () => {
    document.body.requestPointerLock();
    mouseTime = performance.now();
    audio.playMusic();
});

// Gatilho alternativo: caso o jogador comece a jogar pelo teclado (ex.:
// aperta W antes de clicar), a música também é destravada. Os navegadores
// exigem QUALQUER gesto do usuário (clique ou tecla) para permitir áudio;
// isso garante que a música não dependa só do clique no container.
window.addEventListener('keydown', () => {
    audio.playMusic();
}, { once: true });

const hud = document.getElementById("hud");

//HUD
document.addEventListener("pointerlockchange", () => {

    if (document.pointerLockElement) {

        hud.style.display = "none";

    } else {

        hud.style.display = "block";

    }

});

// FUNÇÃO PARA LANÇAR ESFERAS
document.addEventListener('mouseup', (event) => {
    if(document.pointerLockElement != null) throwBall();
});

window.addEventListener( 'resize', onWindowResize );

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function throwBall() {
    audio.playSound("fireball");

    const sphere = spheres[sphereIdx];
    
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(player.model.quaternion);
    direction.y = 0; 
    direction.normalize();
    
    sphere.collider.center.copy(player.collider.end).addScaledVector(direction, player.collider.radius * 1.5);

    const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));

    sphere.velocity.copy(direction).multiplyScalar(impulse);
    sphere.velocity.addScaledVector(player.velocity, 2);

    sphereIdx = (sphereIdx + 1) % spheres.length;
}

function playerSphereCollision( sphere ) {

    const center = vector1.addVectors( player.collider.start, player.collider.end ).multiplyScalar( 0.5 );

    const sphere_center = sphere.collider.center;

    const r = player.collider.radius + sphere.collider.radius;
    const r2 = r * r;

    for ( const point of [ player.collider.start, player.collider.end, center ] ) {

        const d2 = point.distanceToSquared( sphere_center );

        if ( d2 < r2 ) {

            const normal = vector1.subVectors( point, sphere_center ).normalize();
            const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( player.velocity ) );
            const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( sphere.velocity ) );

            player.velocity.add( v2 ).sub( v1 );
            sphere.velocity.add( v1 ).sub( v2 );

            const d = ( r - Math.sqrt( d2 ) ) / 2;
            sphere_center.addScaledVector( normal, - d );

        }

    }

}

function spheresCollisions() {

    for ( let i = 0, length = spheres.length; i < length; i ++ ) {

        const s1 = spheres[ i ];

        for ( let j = i + 1; j < length; j ++ ) {

            const s2 = spheres[ j ];

            const d2 = s1.collider.center.distanceToSquared( s2.collider.center );
            const r = s1.collider.radius + s2.collider.radius;
            const r2 = r * r;

            if ( d2 < r2 ) {

                const normal = vector1.subVectors( s1.collider.center, s2.collider.center ).normalize();
                const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( s1.velocity ) );
                const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( s2.velocity ) );

                s1.velocity.add( v2 ).sub( v1 );
                s2.velocity.add( v1 ).sub( v2 );

                const d = ( r - Math.sqrt( d2 ) ) / 2;

                s1.collider.center.addScaledVector( normal, d );
                s2.collider.center.addScaledVector( normal, - d );

            }

        }

    }

}

function updateSpheres( deltaTime ) {

    spheres.forEach( sphere => {

        sphere.collider.center.addScaledVector( sphere.velocity, deltaTime );

        const result = worldOctree.sphereIntersect( sphere.collider );

        if ( result ) {

            sphere.velocity.addScaledVector( result.normal, - result.normal.dot( sphere.velocity ) * 1.5 );
            sphere.collider.center.add( result.normal.multiplyScalar( result.depth ) );

        } else {

            sphere.velocity.y -= GRAVITY * deltaTime;

        }

        const damping = Math.exp( - 1.5 * deltaTime ) - 1;
        sphere.velocity.addScaledVector( sphere.velocity, damping );

        playerSphereCollision( sphere );

    } );

    spheresCollisions();

    for ( const sphere of spheres ) {

        sphere.mesh.position.copy( sphere.collider.center );

    }

}

const path1 = 'collision-world.glb'
const path2 = 'super_mario_64_bob-omb_battlefield.glb'
const path3 = 'super_mario_64_-_lethal_lava_land.glb'

const loader = new GLTFLoader().setPath( './models/gltf/' );

loader.load( path3,( gltf ) => {

    scene.add( gltf.scene );
    
    worldOctree.fromGraphNode( gltf.scene );

    gltf.scene.traverse( child => {

        if ( child.isMesh ) {

            child.castShadow = true;
            child.receiveShadow = true;

            if ( child.material.map ) {

                child.material.map.anisotropy = 4;

            }

        }

    } );

    const helper = new OctreeHelper( worldOctree );
    helper.visible = false;
    scene.add( helper );

    const gui = new GUI( { width: 200 } );
    gui.add( { debug: false }, 'debug' )
        .onChange( function ( value ) {

            helper.visible = value;

        } );

} );

function animate() {

    timer.update();

    const deltaTime = Math.min( 0.05, timer.getDelta() ) / STEPS_PER_FRAME;


    platforms.forEach(platform => {

        platform.update(deltaTime);

    });

    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {

        player.update( deltaTime );

        updateSpheres( deltaTime );

        player.checkOutOfBounds();

    }

    player.updateMixer( deltaTime * STEPS_PER_FRAME );

    renderer.render( scene, camera );

    // Atualiza as moedas (com verificação de segurança)
    if (player.model) {
        coins.forEach(coin => {
            coin.update(deltaTime);
            
            if (coin.isNearby(player.model.position)) {
                const collected = coin.collect();
                if (collected) {
                    // Moeda coletada! Toca o som (uma única vez, pois
                    // collect() só retorna true na primeira coleta) e
                    // recupera exatamente 1 ponto de vida, respeitando
                    // o limite máximo (heal -> setHealth já faz o clamp).
                    audio.playSound("coin");
                    player.heal(1);
                }
            }
        });
    }

}