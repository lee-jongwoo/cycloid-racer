// Initialize the path drawer
const startPoint = { x: 100, y: 200 };
const endPoint = { x: 700, y: 400 };
const pathDrawer = new PathDrawer(canvas, world, startPoint, endPoint);

// Add a clear button functionality
function clearPath() {
    pathDrawer.clearPath();
}