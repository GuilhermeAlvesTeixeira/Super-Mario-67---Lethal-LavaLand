import * as THREE from "three";

export class MovingPlatform {

    constructor(scene, options = {}) {

        this.start = options.start.clone();
        this.end = options.end.clone();

        this.speed = options.speed ?? 2;
        this.size = options.size ?? new THREE.Vector3(5, 1, 5);

        this.t = 0;
        this.direction = 1;

        this.previousPosition = this.start.clone();

        /*
        AABB (Box3) usado para a colisão física com o jogador. A
        plataforma NÃO entra no Octree do cenário. Ela mantém sua
        própria colisão dinâmica, recalculada a cada update().
        */
        this.box = new THREE.Box3();

        /* Estado usado por platformPlayerCollision() para saber se o
           jogador está apoiado nesta plataforma (e logo deve ser
           transportado junto no próximo frame).
        */
        this.playerOnPlatform = false;

        const geometry = new THREE.BoxGeometry(
            this.size.x,
            this.size.y,
            this.size.z
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0x996633
        });

        this.mesh = new THREE.Mesh(geometry, material);

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        this.mesh.position.copy(this.start);

        scene.add(this.mesh);

        this.updateBoundingBox();

    }

    update(deltaTime) {

        this.previousPosition.copy(this.mesh.position);

        const distance = this.start.distanceTo(this.end);

        this.t += this.direction * (this.speed * deltaTime) / distance;

        if (this.t >= 1) {
            this.t = 1;
            this.direction = -1;
        }

        if (this.t <= 0) {
            this.t = 0;
            this.direction = 1;
        }

        this.mesh.position.lerpVectors(
            this.start,
            this.end,
            this.t
        );

        this.updateBoundingBox();

    }

    /*
      Recalcula o AABB (Box3) a partir da posição atual do mesh. Chamado
      internamente pelo update(), mas exposto caso seja necessário
      recalcular fora do loop normal (ex.: logo após instanciar).
    */
    updateBoundingBox() {

        this.box.setFromCenterAndSize(
            this.mesh.position,
            this.size
        );

    }

    getDeltaMovement() {

        const delta = new THREE.Vector3().subVectors(
            this.mesh.position,
            this.previousPosition
        );

        this.previousPosition.copy(this.mesh.position);

        return delta;

    }

}