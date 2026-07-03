import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class Coin {
    constructor(scene, position, modelUrl = '/Models/coin.glb') {
        this.scene = scene;
        this.position = position.clone();
        this.modelUrl = modelUrl;
        this.model = null;
        this.isCollected = false;
        this.rotationSpeed = 0.5;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.initialY = position.y;
        this.collectDistance = 1;      // raio de coleta no plano horizontal (X/Z)
        this.collectHeight = 1.2;      // tolerância de coleta no eixo vertical (Y)
        
        this.loadModel();
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(
            this.modelUrl,
            (gltf) => {
                this.model = gltf.scene;
                this.model.position.copy(this.position);
                this.model.scale.set(0.008, 0.008, 0.008);
                this.makeRed(this.model);
                this.scene.add(this.model);
            },
            undefined,
            () => {
                this.createFallbackCoin();
            }
        );
    }
    
    // usamos a função setRedMaterial(material) e aplicamos no objeto para que ele fique vermelho
    makeRed(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => this.setRedMaterial(mat));
                } else if (child.material) {
                    this.setRedMaterial(child.material);
                }
            }
        });
    }
    
    setRedMaterial(material) {
        material.color.setHex(0xff0000);
        
        if (material.emissive) {
            material.emissive.setHex(0xff0000);
            material.emissiveIntensity = 0.3;
        }
        
        if (material.metalness !== undefined) {
            material.metalness = 0.8;
        }
        
        if (material.roughness !== undefined) {
            material.roughness = 0.2;
        }
        
        material.needsUpdate = true;
    }
    
    createFallbackCoin() {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.copy(this.position);
        this.model.rotation.x = Math.PI / 2;
        this.model.scale.set(0.008, 0.008, 0.008);
        
        this.scene.add(this.model);
    }
    
    update(deltaTime) {
        if (!this.model || this.isCollected) return;
        
        // rotações no eixo y par ficar que nem no Mario 64 :)
        this.model.rotation.y += this.rotationSpeed * deltaTime * 30;
        this.floatOffset += deltaTime * 2;
        this.model.position.y = this.initialY + Math.sin(this.floatOffset) * 0.1;
    }
    
    collect() {
        if (this.isCollected) return false;
        
        this.isCollected = true;
        
        if (this.model) {
            this.scene.remove(this.model);
            this.model = null;
        }
        
        return true;
    }
    
    // Identificar se está próximo do jogador
    isNearby(playerPosition) {
        if (this.isCollected || !this.model) return false;
        
        const dx = this.model.position.x - playerPosition.x;
        const dz = this.model.position.z - playerPosition.z;
        const dy = this.model.position.y - playerPosition.y;

        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        return horizontalDist < this.collectDistance && Math.abs(dy) < this.collectHeight;
    }
}