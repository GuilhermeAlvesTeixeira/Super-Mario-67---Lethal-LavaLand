import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { AudioManager } from './AudioManager.js';
import { HealthUI } from './HealthUI.js';
import { ParticleEffect } from './ParticleEffect.js';
import { platformPlayerCollision } from './PlatformCollision.js';

// Velocidades de movimento (chão e ar)
const WALK_SPEED = 25;
const RUN_SPEED = 50;
const AIR_SPEED = 8;
const JUMP_FORCE = 15;

// Configuração da câmera de terceira pessoa (atrás do Mario)
const CAMERA_OFFSET = new THREE.Vector3(0, 3, -7);
const CAM_COLLISION_MARGIN = 0.3;
const CAM_MIN_DISTANCE = 1.5;

export class Player {
    constructor(scene, worldOctree, camera, { gravity, startPosition, modelUrl, audio, platforms }) {
        this.scene = scene;
        this.worldOctree = worldOctree;
        this.camera = camera;
        this.gravity = gravity;
        this.audio = audio;

        // Plataformas móveis (fora do Octree). 
        this.platforms = platforms ?? [];

        // ===================== EFEITOS =========================
        this.lavaSmoke = new ParticleEffect(scene, {
            texture: '/Images/smoke.png',
            color: 0xff6633,        
            maxParticles: 40,
            spawnRate: 2,           
            lifeMin: 1.0,
            lifeMax: 2.5,
            sizeMin: 0.2,
            sizeMax: 1.2,
            speedY: 0.3,
            speedSpread: 0.3,
            offsetY: 0,
            offsetZ: 0,
            opacity: 0.7
        });

        this.dust = new ParticleEffect(scene, {
            texture: '/Images/smoke.png',
            color: 0xbbaa88,
            maxParticles: 20,
            spawnRate: 0.8,
            lifeMin: 1.0,
            lifeMax: 2.0,
            sizeMin: 0.1,
            sizeMax: 0.4,
            speedY: 0.9,
            speedSpread: -1,
            offsetY: 0.2,
            offsetZ: -0.4,
            opacity: 0.3
        });

        // ===================== TIMERS =========================
        this.lavaTimer = null;

        // ===================== SISTEMA DE VIDA (UI) =====================
        this.maxHealth = 9;
        this.currentHealth = 9;
        this.healthUI = new HealthUI({
            maxHealth: this.maxHealth,
            spriteUrl: '/Images/hearts_spritesheet.png'
        });
        this.isDead = false;

        

        // ===================== POSIÇÃO INICIAL =====================
        this.startPosition = {
            start: startPosition.start.clone(),
            end: startPosition.end.clone()
        };

        // ===================== COLLIDER =====================
        this.collider = new Capsule(
            this.startPosition.start.clone(),
            this.startPosition.end.clone(),
            0.35
        );

        // ===================== MOVIMENTO =====================
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onFloor = false;
        this.isRunning = false;

        // ===================== CÂMERA =====================
        this.yaw = 0;
        this.pitch = 0;
        this.cameraRay = new THREE.Ray();
        this.desiredCameraPos = new THREE.Vector3();

        // ===================== ANIMAÇÃO =====================
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.currentState = 'Idle';

        // ===================== INPUT =====================
        this.keyStates = {};
        this.bindInputEvents();

        this.loadModel(modelUrl);
    }

    // ===================== CARREGAMENTO =====================
    loadModel(modelUrl) {
        const loader = this.createLoaderWithDraco();

        loader.load(
            modelUrl,
            (gltf) => {
                this.model = gltf.scene;
                this.model.scale.set(0.05, 0.05, 0.05);
                this.model.position.copy(this.collider.start);
                this.model.position.y -= 0.5;
                this.model.rotation.y = 0;
                this.scene.add(this.model);

                this.mixer = new THREE.AnimationMixer(this.model);
                this.loadAnimations(gltf);

                if (this.actions['Idle']) {
                    this.activeAction = this.actions['Idle'];
                    this.activeAction.play();
                }
            },
            undefined,
            (error) => {
                console.error('Erro ao carregar modelo:', error);
            }
        );
    }

    createLoaderWithDraco() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
        return loader;
    }

    loadAnimations(gltf) {
        if (!gltf || !gltf.animations) {
            console.warn('Nenhuma animação encontrada no modelo do Mario');
            return;
        }

        gltf.animations.forEach((clip) => {
            const name = clip.name;
            if (name === '0TPose') {
                this.actions['Idle'] = this.mixer.clipAction(clip);
            } else if (name === 'Walk') {
                this.actions['Walk'] = this.mixer.clipAction(clip);
            } else if (name === 'Jump') {
                this.actions['Jump'] = this.mixer.clipAction(clip);
            }
        });
    }

    // ===================== INPUT =====================
    bindInputEvents() {
        document.addEventListener('keydown', (event) => {
            this.keyStates[event.code] = true;

            if (event.code === 'KeyR') {
                this.audio.playSound("yeahoo");
                this.reset();
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keyStates[event.code] = false;
        });

        document.body.addEventListener('mousemove', (event) => {
            if (!document.pointerLockElement) return;

            this.yaw -= event.movementX * 0.002;
            this.pitch -= event.movementY * 0.002;

            this.pitch = Math.max(
                -Math.PI / 3,
                Math.min(Math.PI / 3, this.pitch)
            );
        });
    }

    handleInput(deltaTime) {
        if (this.isDead) return;

        this.isRunning = !!this.keyStates['ShiftLeft'];

        const speed = this.onFloor
            ? (this.isRunning ? RUN_SPEED : WALK_SPEED)
            : AIR_SPEED;
        const speedDelta = deltaTime * speed;

        if (this.keyStates['KeyW']) {
            this.velocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }
        if (this.keyStates['KeyS']) {
            this.velocity.add(this.getBackwardVector().multiplyScalar(speedDelta));
        }
        if (this.keyStates['KeyA']) {
            this.velocity.add(this.getLeftVector().multiplyScalar(-speedDelta));
        }
        if (this.keyStates['KeyD']) {
            this.velocity.add(this.getRightVector().multiplyScalar(-speedDelta));
        }

        if (this.onFloor && this.keyStates['Space']) {
            this.velocity.y = JUMP_FORCE;
            this.audio.playSound("jump");
        }
    }

    getForwardVector() {
        this.direction.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        return this.direction.normalize();
    }

    getBackwardVector() {
        this.direction.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        return this.direction.normalize();
    }

    getLeftVector() {
        this.direction.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
        return this.direction.normalize();
    }

    getRightVector() {
        this.direction.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        return this.direction.normalize();
    }

    // ===================== FÍSICA =====================
    updatePhysics(deltaTime) {
        if (this.isDead) return;

        let damping = Math.exp(-4 * deltaTime) - 1;

        if (!this.onFloor) {
            this.velocity.y -= this.gravity * deltaTime;
            damping *= 0.1;
        }

        this.velocity.addScaledVector(this.velocity, damping);

        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.collider.translate(deltaPosition);

        this.resolveWorldCollisions();
        this.resolvePlatformCollisions(deltaTime);
    }

    resolveWorldCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.collider);

        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y >= 0.30;

            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
            }

            if (result.depth >= 1e-10) {
                this.collider.translate(result.normal.multiplyScalar(result.depth));
            }
        }
    }

    // Resolve a colisão com cada plataforma móvel.
    resolvePlatformCollisions(deltaTime) {
        for (const platform of this.platforms) {
            platformPlayerCollision(platform, this, deltaTime);
        }
    }

    // ==================== EFEITOS ========================
    updateEffects(deltaTime) {
        if (!this.model || this.isDead) return;

        const pos = this.model.position;
        const rot = -this.model.rotation.y;

        this.lavaSmoke.setPosition(pos, rot);
        this.dust.setPosition(pos, rot);

        this.lavaSmoke.update(deltaTime);
        this.dust.update(deltaTime);

        const speed = this.velocity.length();
        if (this.onFloor && speed > 1) {
            this.dust.start();
        } else {
            this.dust.stop();
        }
    }

    // ===================== MODELO 3D =====================
    updateModel() {
        if (!this.model || this.isDead) return;

        this.model.position.copy(this.collider.start);
        this.model.position.y -= 0.5;

        const horizontalSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;

        if (horizontalSpeedSq > 1) {
            const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = targetRotation - this.model.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.model.rotation.y += diff * 0.15;
        }
    }

    // ===================== CÂMERA =====================
    updateCamera() {
        if (!this.model || this.isDead) return;

        const rotation = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        const offset = CAMERA_OFFSET.clone().applyEuler(rotation);

        this.desiredCameraPos.copy(this.model.position).add(offset);

        const origin = this.model.position.clone();
        origin.y += 1;

        const direction = this.desiredCameraPos.clone().sub(origin);
        const desiredDistance = direction.length();
        direction.normalize();

        this.cameraRay.origin.copy(origin);
        this.cameraRay.direction.copy(direction);

        const hit = this.worldOctree.rayIntersect(this.cameraRay);

        let finalDistance = desiredDistance;

        if (hit && hit.distance < desiredDistance) {
            finalDistance = Math.max(hit.distance - CAM_COLLISION_MARGIN, CAM_MIN_DISTANCE);
        }

        const finalCameraPos = origin.clone().add(direction.multiplyScalar(finalDistance));

        this.camera.position.lerp(finalCameraPos, 0.5);

        this.camera.lookAt(
            this.model.position.x,
            this.model.position.y + 1,
            this.model.position.z
        );
    }

    // ===================== ANIMAÇÃO =====================
    updateAnimation() {
        if (!this.model || this.isDead) return;

        if (!this.onFloor) {
            this.setAnimationState('Jump');
            return;
        }

        const horizontalSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
        const isMoving = horizontalSpeedSq > 0.01;

        if (isMoving) {
            this.setAnimationState('Walk');
        } else {
            this.setAnimationState('Idle');
        }
    }

    setAnimationState(state) {
        if (this.currentState === state) return;
        this.currentState = state;
        this.switchAnimation(state);
    }

    switchAnimation(name) {
        if (!this.mixer) return;

        const nextAction = this.actions[name];
        if (!nextAction) {
            console.warn(`Animação "${name}" não encontrada`);
            return;
        }

        if (nextAction === this.activeAction) return;

        if (this.activeAction) {
            this.activeAction.fadeOut(0.25);
        }

        this.activeAction = nextAction;
        this.activeAction.reset().fadeIn(0.25).play();
    }

    updateMixer(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }

    // ===================== LOOP PRINCIPAL =====================
    update(deltaTime) {
        this.handleInput(deltaTime);
        this.updatePhysics(deltaTime);
        this.updateModel();
        this.updateCamera();
        this.updateAnimation();
        this.updateEffects(deltaTime);
        this.checkLava();
        this.checkOutOfBounds();
    }

    // ===================== RESET / OOB =====================
    reset() {
        this.isDead = false;
        
        this.collider.start.copy(this.startPosition.start);
        this.collider.end.copy(this.startPosition.end);

        this.velocity.set(0, 0, 0);

        this.yaw = 0;
        this.pitch = 0;

        if (this.model) {
            this.model.position.copy(this.collider.start);
            this.model.position.y -= 0.5;
            this.model.rotation.set(0, 0, 0);
        }

        // Vida cheia, refletida na UI
        this.setHealth(this.maxHealth);

        // Para e remove qualquer efeito de partícula em andamento
        this.lavaSmoke.clear();
        this.dust.clear();
        
        clearTimeout(this.lavaTimer);
    }

    checkOutOfBounds() {
        if (this.collider.start.y <= -25) {
            this.takeDamage(9);
        }
    }

    checkLava() {
        const x = this.collider.start.x;
        const z = this.collider.start.z;

        if (
            x >= 0 && x <= 132 &&
            z >= -132 && z <= 0 &&
            this.collider.start.y <= 0.25 &&
            this.velocity.y <= 0
        ) {
            const died = this.takeDamage(2.5);

            // Se morreu, o reset() já deixou tudo zerado (posição, vida,
            // partículas). Não aplica o "bounce" nem reinicia a fumaça.
            if (died) return;

            this.audio.playSound("lava");
            this.velocity.y = JUMP_FORCE * 2;

            this.lavaSmoke.start();
            
            clearTimeout(this.lavaTimer);
            this.lavaTimer = setTimeout(() => {
                this.lavaSmoke.stop();
            }, 3000);
        }
    }

    // ===================== SISTEMA DE VIDA =====================
    setHealth(newHealth) {
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, newHealth));
        if (this.healthUI) {
            this.healthUI.setHealth(this.currentHealth);
        }
    }

    takeDamage(amount = 1) {
        if (this.isDead) return true;
        
        const newHealth = this.currentHealth - amount;
        this.setHealth(newHealth);
        
        if (this.healthUI) {
            this.healthUI.playDamageEffect();
        }
        
        // Se a vida chegar a 0, respawna na hora
        if (this.currentHealth <= 0) {
            this.isDead = true;
            this.audio.playSound("death");

            this.reset();
            return true; // morreu e já foi resetado
        }

        return false;
    }

    heal(amount = 1) {
        if (this.isDead) return;
        
        const newHealth = this.currentHealth + amount;
        this.setHealth(newHealth);
        
        if (this.healthUI) {
            this.healthUI.playHealEffect();
        }
    }
}