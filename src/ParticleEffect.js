
import * as THREE from 'three';

export class ParticleEffect {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.particles = [];
        this.active = false;
        this.pos = new THREE.Vector3();
        this.rot = 0;

        // configurações 
        this.config = {
            texture: options.texture || '/Images/smoke.png',
            color: options.color || 0xcccccc,
            maxParticles: options.maxParticles || 50,
            spawnRate: options.spawnRate || 1,
            lifeMin: options.lifeMin || 1.0,
            lifeMax: options.lifeMax || 2.0,
            sizeMin: options.sizeMin || 0.2,
            sizeMax: options.sizeMax || 1.0,
            speedY: options.speedY || 0.2,
            speedSpread: options.speedSpread || 0.2,
            offsetX: options.offsetX || 0,
            offsetY: options.offsetY || 0.5,
            offsetZ: options.offsetZ || -0.8,
            followRotation: options.followRotation !== undefined ? options.followRotation : true,
            fadeOut: options.fadeOut !== undefined ? options.fadeOut : true,
            grow: options.grow !== undefined ? options.grow : true,
            opacity: options.opacity || 0.8
        };

        this.texture = new THREE.TextureLoader().load(this.config.texture);
    }

    // controles
    start() { this.active = true; }
    stop() { this.active = false; }
    toggle() { this.active = !this.active; }

    // pos
    setPosition(position, rotationY = 0) {
        this.pos.copy(position);
        this.rot = rotationY;
    }

    spawn() {

        let x, y, z;

        if (this.config.followRotation) {
            // Rotaciona APENAS o offset local (em torno do Mario),
            // e só depois soma à posição atual dele.
            const offX = this.config.offsetX;
            const offZ = this.config.offsetZ;

            const rotX = offX * Math.cos(this.rot) - offZ * Math.sin(this.rot);
            const rotZ = offX * Math.sin(this.rot) + offZ * Math.cos(this.rot);

            x = this.pos.x + rotX;
            z = this.pos.z + rotZ;
        } else {
            x = this.pos.x + this.config.offsetX;
            z = this.pos.z + this.config.offsetZ;
        }

        y = this.pos.y + this.config.offsetY;

        // aleatoriadade :-)
        x += (Math.random() - 0.5) * 0.3;
        y += (Math.random() - 0.5) * 0.1;
        z += (Math.random() - 0.5) * 0.3;

        // criar sprite
        const material = new THREE.SpriteMaterial({
            map: this.texture,
            transparent: true,
            opacity: this.config.opacity,
            color: this.config.color,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        
        const startSize = this.config.sizeMin + Math.random() * (this.config.sizeMax - this.config.sizeMin) * 0.3;
        sprite.scale.set(startSize, startSize, 1);

        this.scene.add(sprite);

        
        this.particles.push({
            mesh: sprite,
            life: 0,
            maxLife: this.config.lifeMin + Math.random() * (this.config.lifeMax - this.config.lifeMin),
            velX: (Math.random() - 0.5) * this.config.speedSpread,
            velY: this.config.speedY * (0.5 + Math.random() * 0.5),
            velZ: (Math.random() - 0.5) * this.config.speedSpread,
            startScale: startSize,
            endScale: this.config.sizeMin + Math.random() * (this.config.sizeMax - this.config.sizeMin)
        });

        // limpa tudo
        if (this.particles.length > this.config.maxParticles) {
            const old = this.particles.shift();
            this.scene.remove(old.mesh);
        }
    }

    // update
    update(deltaTime) {

        if (this.active) {
            const spawnCount = Math.floor(this.config.spawnRate);
            for (let i = 0; i < spawnCount; i++) {
                this.spawn();
            }
     
            if (Math.random() < this.config.spawnRate % 1) {
                this.spawn();
            }
        }

        // atualizar partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life += deltaTime;

            
            if (p.life >= p.maxLife) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            const progress = p.life / p.maxLife;

            p.mesh.position.x += p.velX * deltaTime;
            p.mesh.position.y += p.velY * deltaTime;
            p.mesh.position.z += p.velZ * deltaTime;

            // cresce
            if (this.config.grow) {
                const scale = p.startScale + (p.endScale - p.startScale) * progress;
                p.mesh.scale.set(scale, scale, 1);
            }
            
            // fade out
            if (this.config.fadeOut) {
                p.mesh.material.opacity = this.config.opacity * (1 - progress);
            }
        }
    }
    
    // limpa
    clear() {
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.particles = [];
        this.active = false;
    }

    // destruir
    dispose() {
        this.clear();
        this.texture.dispose();
    }
}