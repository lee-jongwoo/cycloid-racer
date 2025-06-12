const engine = Matter.Engine.create()
const world = engine.world

const render = Matter.Render.create({
  element: document.getElementById('game'),
  engine: engine,
  options: {
    width: 800,
    height: 600,
    wireframes: false
  }
});

Matter.Render.run(render);

const runner = Matter.Runner.create();
Matter.Runner.run(runner, engine);
