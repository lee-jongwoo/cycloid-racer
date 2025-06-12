const engine = Matter.Engine.create()
const world = engine.world

const WIDTH = window.innerWidth * 0.8;
const HEIGHT = WIDTH * 0.6;

const render = Matter.Render.create({
  element: document.getElementById('game'),
  engine: engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    wireframes: false
  }
});

Matter.Render.run(render);

const runner = Matter.Runner.create();
Matter.Runner.run(runner, engine);

const ground = Matter.Bodies.rectangle(WIDTH / 2, HEIGHT - 20, WIDTH, 40, { isStatic: true });
const startPoint = { x: 100, y: 100 };
const endPoint = { x: WIDTH - 100, y: HEIGHT - 100 };
const ball = Matter.Bodies.circle(startPoint.x, startPoint.y, 20, {
  restitution: 0.8,
  friction: 0.05
});
const line = Matter.Bodies.rectangle(
  (startPoint.x + endPoint.x) / 2,
  (startPoint.y + endPoint.y) / 2 + 40,
  Math.abs(endPoint.x - startPoint.x) + 500,
  10,
  {
    isStatic: true,
    angle: Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x),
    render: {
      fillStyle: 'blue',
      strokeStyle: 'black',
      lineWidth: 2
    }
  }
);
Matter.World.add(world, [ground, ball, line]);