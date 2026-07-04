import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import type { World } from "./world";
import { resources } from "./blocks";
import type { Player } from "./player";

export function createUI(scene: THREE.Scene, world: World, player: Player) {
  const gui = new GUI();


  const sceneFolder = gui.addFolder("Scene");
  // @ts-ignore
  sceneFolder.add(scene.fog, 'near', 1, 200, 1).name('Fog Near');
  // @ts-ignore
  sceneFolder.add(scene.fog, 'far', 1, 200, 1).name('Fog Far');

  const playerFolder = gui.addFolder('Player');
  playerFolder.add(player, 'maxSpeed', 1, 20).name('Max Speed');
  playerFolder.add(player.cameraHelper, 'visible').name('Show Camera Helper');

  
  const terrainFolder = gui.addFolder("Terrain");
  terrainFolder.add(world, "asyncLoading").name("Async Chunk Loading");
  terrainFolder.add(world, "drawDistance", 0, 5).name("Render Distance");
  terrainFolder.add(world.params, "seed", 0, 10000).name("Seed");
  terrainFolder.add(world.params.terrain, "scale", 10, 100).name("Scale");
  terrainFolder.add(world.params.terrain, "magnitude", 0, 1).name("Magnitude");
  terrainFolder.add(world.params.terrain, "offset", 0, 1).name("Offset");

  resources.forEach((resource) => {
    const resourcesFolder = gui.addFolder(`Resource: ${resource.name}`);
    resourcesFolder.add(resource, "scarcity", 0, 1).name("Scarcity");

    const scaleFolder = resourcesFolder.addFolder("Scale");
    scaleFolder.add(resource.scale, "x", 1, 100).name("Scale X");
    scaleFolder.add(resource.scale, "y", 1, 100).name("Scale Y");
    scaleFolder.add(resource.scale, "z", 1, 100).name("Scale Z");
  });
  gui.onChange(() => {
    world.generate();
  });
}
