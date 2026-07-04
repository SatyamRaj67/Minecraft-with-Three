import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import type { World } from "./world";
import { blocks } from "./blocks";

export function createUI(world: World) {
  const gui = new GUI();

  gui.add(world.size, "width", 8, 128, 1).name("Width");
  gui.add(world.size, "height", 8, 128, 1).name("Height");

  const terrainFolder = gui.addFolder("Terrain");
  terrainFolder.add(world.params, "seed", 0, 10000).name("Seed");
  terrainFolder.add(world.params.terrain, "scale", 10, 100).name("Scale");
  terrainFolder.add(world.params.terrain, "magnitude", 0, 1).name("Magnitude");
  terrainFolder.add(world.params.terrain, "offset", 0, 1).name("Offset");

  const resourcesFolder = gui.addFolder("Resources");
  resourcesFolder.add(blocks.stone, "scarcity", 0, 1).name("Scarcity");

  const scaleFolder = gui.addFolder("Scale");
  scaleFolder.add(blocks.stone.scale, "x", 1, 100).name("Scale X");
  scaleFolder.add(blocks.stone.scale, "y", 1, 100).name("Scale Y");
  scaleFolder.add(blocks.stone.scale, "z", 1, 100).name("Scale Z");

  gui.onChange(() => {
    world.generate();
  });
}
