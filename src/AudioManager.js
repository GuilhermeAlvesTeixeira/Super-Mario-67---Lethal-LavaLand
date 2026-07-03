import * as THREE from "three";

export class AudioManager {

    constructor(camera) {

        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.loader = new THREE.AudioLoader();

        // Música
        this.music = new THREE.Audio(this.listener);

        // O carregamento do buffer (loadMusic) é assíncrono. Se o jogador
        // clicar antes dele terminar, `this.music.play()` marcaria
        // `isPlaying = true` mesmo sem áudio nenhum tocando (THREE.Audio
        // não valida se há buffer), "queimando" a única tentativa e
        // deixando a música muda pelo resto da sessão. Esses dois flags
        // resolvem isso: só chamamos play() de verdade quando o buffer
        // já existe, e lembramos o pedido do jogador até esse momento.
        this.musicReady = false;
        this.musicRequested = false;

        // Efeitos
        this.sounds = {};

    }

    loadMusic(path) {

        this.loader.load(path, (buffer) => {

            this.music.setBuffer(buffer);
            this.music.setLoop(true);
            this.music.setVolume(1);

            this.musicReady = true;

            //O jogador já tinha pedido pra tocar (ex.: clicou antes do
            // carregamento terminar) — inicia agora que o buffer existe.
            if (this.musicRequested) {
                this.startMusic();
            }

        });

    }

    playMusic() {

        this.musicRequested = true;

        // a política de autoplay dos navegadores exige um gesto do
        // usuário para "destravar" o áudio. garantimos isso aqui, dentro
        // do próprio gesto que chamou playMusic().
        this.resumeContext();

        if (this.musicReady) {
            this.startMusic();
        }

        // Se o buffer ainda não estiver pronto, loadMusic() chama
        // startMusic() automaticamente assim que ele terminar de carregar.

    }

    startMusic() {

        if (!this.music.isPlaying) {
            this.music.play();
        }

    }

    resumeContext() {

        const context = this.listener.context;

        if (context.state === "suspended") {
            context.resume();
        }

    }

    stopMusic() {

        this.musicRequested = false;

        if (this.music.isPlaying)
            this.music.stop();

    }

    loadSound(name, path, volume = 1.0) {

        const sound = new THREE.Audio(this.listener);

        this.loader.load(path, (buffer) => {

            sound.setBuffer(buffer);
            sound.setLoop(false);
            sound.setVolume(volume);

        });

        this.sounds[name] = sound;

    }

    playSound(name) {

        const sound = this.sounds[name];

        if (!sound) return;

        // reinicia caso já esteja tocando
        if (sound.isPlaying)
            sound.stop();

        sound.play();

    }

}