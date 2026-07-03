# Mario 64 – Cena 3D Interativa (Atividade 07 – Trabalho Final)

Cena 3D interativa feita com **Three.js**, inspirada no *Super Mario 64*. O
jogador controla o Mario em terceira pessoa por um cenário carregado de um
modelo `.glb`, com física (Rapier + Octree), moedas colecionáveis, lava,
plataformas móveis e sistema de vida.

## Tecnologias / Dependências

| Pacote | Uso no projeto |
|---|---|
| [`three`](https://www.npmjs.com/package/three) | Renderização 3D, câmera, luzes, materiais, `Octree`, `Capsule`, `GLTFLoader`, `AudioListener` |
| [`@dimforge/rapier3d-compat`](https://www.npmjs.com/package/@dimforge/rapier3d-compat) | Física do jogador e das plataformas móveis (corpos rígidos, colisores, character controller) |
| [`vite`](https://www.npmjs.com/package/vite) | Servidor de desenvolvimento e build (dev dependency) |
| `cannon-es` | Consta no `package.json` mas **não é usada pois foi derivada do código de** | 
https://github.com/mrdoob/three.js/blob/master/examples/games_fps.html| no código atual (pode ser removida com `npm uninstall cannon-es`) |

Requisitos de ambiente:
- **Node.js** 18+ (testado com Node 22)
- **npm** 9+

## Instalação

Dentro da pasta do projeto (`Atividade-07-TrabalhoFinal-Mario_64/`):

```bash
npm install
```

Isso vai instalar `three`, `@dimforge/rapier3d-compat`, `cannon-es` e o `vite`.

## Rodando em modo desenvolvimento

```bash
npm run dev
```

O Vite vai subir um servidor local (por padrão em `http://localhost:5173`).

Abra o link mostrado no terminal em um navegador moderno (Chrome, Edge ou
Firefox recentes, com suporte a WebGL2 e WebAssembly).


## Controles

| Tecla / Ação | Efeito |
|---|---|
| `W A S D` | Movimentação |
| Mouse | Rotaciona a câmera (precisa clicar na tela primeiro para travar o cursor) |
| `Espaço` | Pular |
| `Shift` | Correr |
| Clique do mouse | Atirar bola de fogo |
| `R` | Respawnar o jogador |

## Observações

- O carregamento dos modelos `.glb` usa `DRACOLoader` com decoder carregado
  via CDN do Google (`gstatic.com`); é necessário acesso à internet na
  primeira execução para baixar o decoder.
- Ao clicar na tela pela primeira vez o navegador trava o cursor
  (*Pointer Lock*) e a música de fundo começa a tocar.
