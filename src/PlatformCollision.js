
import * as THREE from "three";

const _p1 = new THREE.Vector3();      // ponto mais próximo no segmento da capsule
const _p2 = new THREE.Vector3();      // ponto mais próximo no Box3
const _segDir = new THREE.Vector3();
const _diff = new THREE.Vector3();
const _faceNormal = new THREE.Vector3();
const _push = new THREE.Vector3();
const _carry = new THREE.Vector3();

// Mesmo critério usado em Player.resolveWorldCollisions() para decidir
// se um contato conta como "piso" (normal apontando suficientemente para cima)
const ON_TOP_THRESHOLD = 0.30;

// Número de iterações do algoritmo de projeção alternada
const ITERATIONS = 4;

/**
 * Restringe (clamp) um ponto aos limites de um Box3 → ponto mais próximo
 * da caixa em relação a esse ponto.
 */
function closestPointOnBox(point, box, target) {
    target.set(
        THREE.MathUtils.clamp(point.x, box.min.x, box.max.x),
        THREE.MathUtils.clamp(point.y, box.min.y, box.max.y),
        THREE.MathUtils.clamp(point.z, box.min.z, box.max.z)
    );
    return target;
}

/**
 * Ponto mais próximo de um segmento de reta (start -> end) em relação a
 * um ponto qualquer.
 */
function closestPointOnSegment(point, start, end, target) {
    _segDir.subVectors(end, start);
    const lengthSq = _segDir.lengthSq();

    let t = 0;
    if (lengthSq > 1e-10) {
        t = (
            (point.x - start.x) * _segDir.x +
            (point.y - start.y) * _segDir.y +
            (point.z - start.z) * _segDir.z
        ) / lengthSq;

        t = THREE.MathUtils.clamp(t, 0, 1);
    }

    return target.copy(start).addScaledVector(_segDir, t);
}

/**
 * Caso raro/extremo: o segmento da capsule já está totalmente DENTRO do
 * Box3 (ex.: jogador foi resetado/teleportado dentro da plataforma). Nesse
 * caso não existe "ponto mais próximo fora da caixa" — escolhemos a face
 * mais próxima e devolvemos a normal + profundidade dessa face.
 */
function resolveDeepPenetration(point, box, radius, outNormal) {
    const dxMin = point.x - box.min.x;
    const dxMax = box.max.x - point.x;
    const dyMin = point.y - box.min.y;
    const dyMax = box.max.y - point.y;
    const dzMin = point.z - box.min.z;
    const dzMax = box.max.z - point.z;

    const faces = [
        { dist: dxMin, normal: [-1, 0, 0] },
        { dist: dxMax, normal: [1, 0, 0] },
        { dist: dyMin, normal: [0, -1, 0] },
        { dist: dyMax, normal: [0, 1, 0] },
        { dist: dzMin, normal: [0, 0, -1] },
        { dist: dzMax, normal: [0, 0, 1] },
    ];

    let closest = faces[0];
    for (let i = 1; i < faces.length; i++) {
        if (faces[i].dist < closest.dist) closest = faces[i];
    }

    outNormal.set(closest.normal[0], closest.normal[1], closest.normal[2]);

    return closest.dist + radius;
}

/**
 * Resolve a colisão entre uma MovingPlatform e o jogador.
 *
 * @param {MovingPlatform} platform - precisa expor `platform.box` (THREE.Box3
 *   atualizado) e `platform.getDeltaMovement()`.
 * @param {Player} player - precisa expor `player.collider` (Capsule) e
 *   `player.velocity`.
 * @param {number} deltaTime - passo de tempo do frame/substep atual.
 * @returns {{normal: THREE.Vector3, penetration: number, onTop: boolean} | null}
 */
export function platformPlayerCollision(platform, player, deltaTime) {
    const box = platform.box;
    const collider = player.collider;
    const radius = collider.radius;

    // 1) Se no frame anterior o jogador estava apoiado nesta plataforma,
    // ele é transportado junto com o deslocamento dela ANTES de qualquer
    // teste de colisão. É isso que faz a plataforma "carregar" o jogador
    // (inclusive lateralmente, não só sustentando o peso dele).
    if (platform.playerOnPlatform) {
        _carry.copy(platform.getDeltaMovement());
        if (_carry.lengthSq() > 1e-12) {
            collider.translate(_carry);
        }
    }

    // 2) Ponto mais próximo entre o segmento da capsule (start -> end) e o
    // Box3 da plataforma, via projeção alternada. Como ambos são convexos,
    // isso converge para o par de pontos de menor distância entre eles.
    _p1.copy(collider.start);
    for (let i = 0; i < ITERATIONS; i++) {
        closestPointOnBox(_p1, box, _p2);
        closestPointOnSegment(_p2, collider.start, collider.end, _p1);
    }

    _diff.subVectors(_p1, _p2);
    const distance = _diff.length();

    let normal;
    let penetration;

    if (distance < 1e-6) {
        // Segmento dentro do Box3 → usa a face mais próxima como referência.
        penetration = resolveDeepPenetration(_p1, box, radius, _faceNormal);
        normal = _faceNormal;
    } else if (distance < radius) {
        normal = _diff.multiplyScalar(1 / distance); // normaliza sem custo extra
        penetration = radius - distance;
    } else {
        // Sem colisão: a capsule não está mais em contato com a plataforma.
        platform.playerOnPlatform = false;
        return null;
    }

    // 3) Corrige a posição exatamente como Player.resolveWorldCollisions()
    // faz com o Octree: empurra a capsule para fora ao longo da normal.
    if (penetration >= 1e-10) {
        collider.translate(_push.copy(normal).multiplyScalar(penetration));
    }

    const onTop = normal.y >= ON_TOP_THRESHOLD;

    if (onTop) {
        // Contato de "piso": a plataforma sustenta o jogador.
        player.onFloor = true;
    } else {
        // Contato lateral ou por baixo (cabeçada): remove a componente da
        // velocidade que aponta para dentro da plataforma, para não
        // atravessar nem "vibrar" contra ela.
        player.velocity.addScaledVector(normal, -normal.dot(player.velocity));
    }

    // Guarda o estado para o próximo frame decidir se deve carregar o jogador.
    platform.playerOnPlatform = onTop;

    return { normal: normal.clone(), penetration, onTop };
}
