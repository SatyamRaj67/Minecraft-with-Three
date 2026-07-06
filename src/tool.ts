import * as THREE from "three";

export class Tool extends THREE.Group {
  // Whether or not the tool is currently animating
  animate = false;
  // Amplitude of the tool animation
  animationAmplitude = 0.5;
  //   Duration of the animation
  animationDuration = 750; // in milliseconds
  // State time for the animation
  animationStart = 0;
  // Speed of the tool animation in rad/s
  animationSpeed = 0.0125;
  // Currently active animation
  animation: number | undefined = undefined;
  // The 3D mesh of the actual tool
  toolMesh: THREE.Mesh | undefined = undefined;

  get animationTime() {
    return performance.now() - this.animationStart;
  }

  /**
   * Trigger a new animation of the tool
   */
  startAnimation() {
    if (this.animate) return;
    this.animate = true;
    this.animationStart = performance.now();

    // Stop existing animation
    clearTimeout(this.animation);
    // Set a timer to stop the animation after a specified duration
    this.animation = setTimeout(() => {
      this.animate = false;
      if (this.toolMesh) {
        this.toolMesh.rotation.y = 0;
      }
    }, this.animationDuration);
  }

  /**
   * Updates the tool animation state
   */
  update() {
    if (this.animate && this.toolMesh) {
      this.toolMesh.rotation.y =
        this.animationAmplitude *
        Math.sin(this.animationTime * this.animationSpeed);
    }
  }

  /**
   * Sets the active tool mesh
   */
  setMesh(mesh: THREE.Mesh) {
    this.clear();

    this.toolMesh = mesh;
    this.add(this.toolMesh);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    this.position.set(0.6, -0.3, -0.5);
    this.scale.set(0.5, 0.5, 0.5);
    this.rotation.z = Math.PI / 2;
    this.rotation.y = Math.PI + 0.2;
  }
}
