import '../health-ui.css';

export class HealthUI {
    constructor({ maxHealth = 9, spriteUrl = '/Images/hearts_spritesheet.png', cols = 3, rows = 3 } = {}) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.cols = cols;
        this.rows = rows;
        this.totalFrames = cols * rows; // n° de frames

        this.container = null;
        this.meter = null;

        this.createUI(spriteUrl);
    }

    createUI(spriteUrl) {
        const old = document.getElementById('health-container');
        if (old) old.remove(); // se for UI veia pôde remove

        this.container = document.createElement('div');
        this.container.id = 'health-container';

        this.meter = document.createElement('div');
        this.meter.id = 'health-meter';
        this.meter.style.backgroundImage = `url('${spriteUrl}')`;
        this.container.appendChild(this.meter);

        document.body.appendChild(this.container);
        this.updateDisplay();
    }

    /*
     Converte vida atual -> índice do frame.
     OBS: nessa spritesheet o frame 0 é o coração CHEIO !!!!!!!!! e o último frame é o VAZIO !!!!! ver em Images/heart_spritesheet,
     então inverte-se o cálculo (totalFrames-1 - frame "normal").
    */

    getFrameForHealth(health) {
        const ratio = Math.max(0, Math.min(1, health / this.maxHealth));
        return this.totalFrames - 1 - Math.round(ratio * (this.totalFrames - 1));
    }

    setHealth(newHealth) {
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, newHealth));
        this.updateDisplay();
    }

    updateDisplay() {
        const frame = this.getFrameForHealth(this.currentHealth);
        const col = frame % this.cols;
        const row = Math.floor(frame / this.cols);

        const xPercent = this.cols > 1 ? (col / (this.cols - 1)) * 100 : 0;
        const yPercent = this.rows > 1 ? (row / (this.rows - 1)) * 100 : 0;

        this.meter.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
    }

    playDamageEffect() {
        this.meter.classList.remove('damage');
        void this.meter.offsetWidth;
        this.meter.classList.add('damage');
        setTimeout(() => this.meter.classList.remove('damage'), 300);

        if (this.currentHealth <= 0) {
            this.meter.classList.add('death');
            setTimeout(() => this.meter.classList.remove('death'), 600);
        }
    }

    playHealEffect() {
        this.meter.classList.remove('heal');
        void this.meter.offsetWidth;
        this.meter.classList.add('heal');
        setTimeout(() => this.meter.classList.remove('heal'), 300);
    }

    dispose() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}