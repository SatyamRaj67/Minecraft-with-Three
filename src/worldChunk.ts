import * as THREE from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { RNG } from "./rng";
import { blocks, resources } from "./blocks.js";
import type { DataStore } from "./dataStore.js";

const geometry = new THREE.BoxGeometry(1, 1, 1);

export class WorldChunk extends THREE.Group {
  /**
   * @type {{
   *  id: number,
   *  instanceId: number | null
   * }[][][]}
   */
  data: { id: number; instanceId: number | null }[][][] = [];

  size: { width: number; height: number };
  params: any;
  dataStore: DataStore;
  loaded: boolean;

  constructor(
    size: { width: number; height: number },
    params: any,
    dataStore: DataStore,
  ) {
    super();
    this.size = size;
    this.params = params;
    this.dataStore = dataStore;
    this.loaded = false;
  }

  /**
   * Generates the world data and meshes
   */
  generate() {
    const start = performance.now();

    const rng = new RNG(this.params.seed);
    this.initialize();
    this.generateResources(rng);
    this.generateTerrain(rng);
    this.generateTrees(rng);
    this.generateClouds(rng);
    this.loadPlayerChanges();
    this.generateMeshes();

    this.loaded = true;

    console.log(`Loaded chunk in ${performance.now() - start}ms`);
  }

  /**
   * Initializes an empty world
   */
  initialize() {
    this.data = [];
    for (let x = 0; x < this.size.width; x++) {
      const slice = [];
      for (let y = 0; y < this.size.height; y++) {
        const row = [];
        for (let z = 0; z < this.size.width; z++) {
          row.push({
            id: blocks.empty.id,
            instanceId: null,
          });
        }
        slice.push(row);
      }
      this.data.push(slice);
    }
  }

  /**
   * Generates resources within the world
   * @param {RNG} rng Random number generator
   */
  generateResources(rng: RNG) {
    for (const resource of resources) {
      const simplex = new SimplexNoise(rng);
      for (let x = 0; x < this.size.width; x++) {
        for (let y = 0; y < this.size.height; y++) {
          for (let z = 0; z < this.size.width; z++) {
            const n = simplex.noise3d(
              (this.position.x + x) / resource.scale.x,
              (this.position.y + y) / resource.scale.y,
              (this.position.z + z) / resource.scale.z,
            );

            if (n > resource.scarcity) {
              this.setBlockId(x, y, z, resource.id);
            }
          }
        }
      }
    }
  }

  /**
   * Generates the world terrain data
   * @param {RNG} rng Random number generator
   */
  generateTerrain(rng: RNG) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        // Compute noise value at this x-z location
        const value = simplex.noise(
          (this.position.x + x) / this.params.terrain.scale,
          (this.position.z + z) / this.params.terrain.scale,
        );

        // Scale noise based on the magnitude and add in the offset
        const scaledNoise =
          this.params.terrain.offset + this.params.terrain.magnitude * value;

        // Compute final height of terrain at this location
        let height = Math.floor(scaledNoise);

        // Clamp between 0 and max height
        height = Math.max(0, Math.min(height, this.size.height - 1));

        // Starting at the terrain height, fill in all the blocks below that height
        for (let y = 0; y < this.size.height; y++) {
          if (y <= this.params.terrain.waterOffset && y <= height) {
            this.setBlockId(x, y, z, blocks.sand.id);
          } else if (y === height) {
            this.setBlockId(x, y, z, blocks.grass.id);
            // Fill in blocks with dirt if they aren't already filled with something else
          } else if (
            y < height &&
            this.getBlock(x, y, z)?.id === blocks.empty.id
          ) {
            // Clear everything above
            this.setBlockId(x, y, z, blocks.dirt.id);
          } else if (y > height) {
            this.setBlockId(x, y, z, blocks.empty.id);
          }
        }
      }
    }
  }

  /**
   * Populate the world with trees
   * @param {RNG} rng
   */
  generateTrees(rng: RNG) {
    const generateTreeTrunk = (x: number, z: number, rng: RNG) => {
      const minH = this.params.trees.trunk.minHeight;
      const maxH = this.params.trees.trunk.maxHeight;
      const h = Math.round(minH + (maxH - minH) * rng.random());

      for (let y = 0; y < this.size.height; y++) {
        const block = this.getBlock(x, y, z);
        if (block && block.id === blocks.grass.id) {
          // The trunk of the tree starts here
          for (let treeY = y + 1; treeY <= y + h; treeY++) {
            this.setBlockId(x, treeY, z, blocks.tree.id);
          }

          generateTreeCanopy(x, y + h, z, rng);
          break;
        }
      }
    };

    const generateTreeCanopy = (
      centerX: number,
      centerY: number,
      centerZ: number,
      rng: RNG,
    ) => {
      const minR = this.params.trees.canopy.minRadius;
      const maxR = this.params.trees.canopy.maxRadius;
      const r = Math.round(minR + (maxR - minR) * rng.random());

      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          for (let y = -r; y <= r; y++) {
            const n = rng.random();
            if (x * x + y * y + z * z >= r * r) continue;
            const block = this.getBlock(centerX + x, centerY + y, centerZ + z);
            if (block && block.id !== blocks.empty.id) continue;

            if (n < this.params.trees.canopy.density) {
              this.setBlockId(
                centerX + x,
                centerY + y,
                centerZ + z,
                blocks.leaves.id,
              );
            }
          }
        }
      }
    };

    let rang = new RNG(this.params.seed + 1); // 
    let offset = this.params.trees.canopy.maxRadius;
    for (let x = offset; x < this.size.width - offset; x++) {
      for (let z = offset; z < this.size.width - offset; z++) {
        if (rang.random() < this.params.trees.frequency) {
          generateTreeTrunk(x, z, rang);
        }
      }
    }
  }

  /**
   * Creates happy little clouds
   * @param {RNG} rng
   */
  generateClouds(rng: RNG) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        const value =
          (simplex.noise(
            (this.position.x + x) / this.params.clouds.scale,
            (this.position.z + z) / this.params.clouds.scale,
          ) +
            1) *
          0.5; // Normalize to [0, 1]

        if (value < this.params.clouds.density) {
          // Create a cloud block at this position
          this.setBlockId(x, this.size.height - 1, z, blocks.cloud.id);
        }
      }
    }
  }

  /**
   * Pulls any changes from the data store and applies them to the data model
   */
  loadPlayerChanges() {
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          // Overwrite with value in data store if it exists
          if (
            this.dataStore.contains(this.position.x, this.position.z, x, y, z)
          ) {
            const blockId = this.dataStore.get(
              this.position.x,
              this.position.z,
              x,
              y,
              z,
            );
            this.setBlockId(x, y, z, blockId);
          }
        }
      }
    }
  }

  generateWater() {
    const material = new THREE.MeshLambertMaterial({
      color: 0x9090e0,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    waterMesh.rotateX(-Math.PI / 2);
    waterMesh.position.set(
      this.size.width / 2,
      this.params.terrain.waterOffset + 0.4,
      this.size.width / 2,
    );
    waterMesh.scale.set(this.size.width, this.size.width, 1);
    waterMesh.layers.set(1); // Set the layer to 1 so it doesn't interfere with raycasting

    this.add(waterMesh);
  }

  /**
   * Generates the meshes from the world data
   */
  generateMeshes() {
    this.disposeChildren();

    this.generateWater();

    // Create lookup table of InstancedMesh's with the block id being the key
    const meshes: { [key: number]: THREE.InstancedMesh } = {};
    Object.values(blocks)
      .filter((blockType) => blockType.id !== blocks.empty.id)
      .forEach((blockType) => {
        const maxCount = this.size.width * this.size.width * this.size.height;
        const mesh = new THREE.InstancedMesh(
          geometry,
          // @ts-expect-error
          blockType.material,
          maxCount,
        );
        mesh.name = blockType.id.toString();
        mesh.count = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes[blockType.id] = mesh;
      });

    // Add instances for each non-empty block
    const matrix = new THREE.Matrix4();
    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          const blockId = this.getBlock(x, y, z)!.id;

          // Ignore empty blocks
          if (blockId === blocks.empty.id) continue;

          const mesh = meshes[blockId];
          const instanceId = mesh.count;

          // Create a new instance if block is not obscured by other blocks
          if (!this.isBlockObscured(x, y, z)) {
            matrix.setPosition(x, y, z);
            mesh.setMatrixAt(instanceId, matrix);
            this.setBlockInstanceId(x, y, z, instanceId);
            mesh.count++;
          }
        }
      }
    }

    // Add all instanced meshes to the scene
    this.add(...Object.values(meshes));
  }

  /**
   * Adds a new block at (x,y,z) of type `blockId`
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} blockId
   */
  addBlock(x: number, y: number, z: number, blockId: number) {
    // Safety check that we aren't adding a block for one that
    // already has an instance
    if (this.getBlock(x, y, z)?.id === blocks.empty.id) {
      this.setBlockId(x, y, z, blockId);
      this.addBlockInstance(x, y, z);
      this.dataStore.set(this.position.x, this.position.z, x, y, z, blockId);
    }
  }

  /**
   * Removes the block at (x, y, z)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  removeBlock(x: number, y: number, z: number) {
    const block = this.getBlock(x, y, z);
    if (block && block.id !== blocks.empty.id) {
      console.log(`Removing block at X:${x} Y:${y} Z:${z}`);
      this.deleteBlockInstance(x, y, z);
      this.setBlockId(x, y, z, blocks.empty.id);
      this.dataStore.set(
        this.position.x,
        this.position.z,
        x,
        y,
        z,
        blocks.empty.id,
      );
    }
  }

  /**
   * Create a new instance for the block at (x,y,z)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  addBlockInstance(x: number, y: number, z: number) {
    const block = this.getBlock(x, y, z);

    // If this block is non-empty and does not already have an instance, create a new one
    if (block && block.id !== blocks.empty.id && !block.instanceId) {
      // Append a new instance to the end of our InstancedMesh
      const mesh = this.children.find(
        (instanceMesh) => instanceMesh.name === block.id.toString(),
      )! as THREE.InstancedMesh;
      const instanceId = mesh!.count!++;
      this.setBlockInstanceId(x, y, z, instanceId);

      // Update the appropriate instanced mesh
      // Also re-compute the bounding sphere so raycasting works
      const matrix = new THREE.Matrix4();
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(instanceId, matrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  /**
   * Removes the mesh instance associated with `block` by swapping it
   * with the last instance and decrementing the instance count.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {{ id: number, instanceId: number }} block
   */
  deleteBlockInstance(x: number, y: number, z: number) {
    const block = this.getBlock(x, y, z)!;

    if (block.id === blocks.empty.id || !block.instanceId) return;

    // Get the mesh and instance id of the block
    const mesh = this.children.find(
      (instanceMesh) => instanceMesh.name === block.id.toString(),
    )! as THREE.InstancedMesh;
    const instanceId = block.instanceId;

    // We can't remove an instance directly, so we swap it with the last instance
    // and decrease the count by 1. We need to do two things:
    //   1. Swap the matrix of the last instance with the matrix at `instanceId`
    //   2. Set the instanceId for the last instance to `instanceId`
    const lastMatrix = new THREE.Matrix4();
    mesh.getMatrixAt(mesh.count - 1, lastMatrix);

    // Also need to get the block coordinates of the instance
    // to update the instance id for that block
    const v = new THREE.Vector3();
    v.setFromMatrixPosition(lastMatrix);
    this.setBlockInstanceId(v.x, v.y, v.z, instanceId);

    // Swap the transformation matrices
    mesh.setMatrixAt(instanceId, lastMatrix);

    // Decrease the mesh count to "delete" the block
    mesh.count--;

    // Notify the instanced mesh we updated the instance matrix
    // Also re-compute the bounding sphere so raycasting works
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    this.setBlockInstanceId(x, y, z, null);
  }

  /**
   * Gets the block data at (x, y, z)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {{id: number, instanceId: number} | null}
   */
  getBlock(
    x: number,
    y: number,
    z: number,
  ): { id: number; instanceId: number | null } | null {
    if (this.inBounds(x, y, z)) {
      return this.data[x][y][z];
    } else {
      return null;
    }
  }

  /**
   * Sets the block id for the block at (x, y, z)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} id
   */
  setBlockId(x: number, y: number, z: number, id: number) {
    if (this.inBounds(x, y, z)) {
      this.data[x][y][z].id = id;
    }
  }

  /**
   * Sets the block instance id for the block at (x, y, z)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} instanceId
   */
  setBlockInstanceId(
    x: number,
    y: number,
    z: number,
    instanceId: number | null,
  ) {
    if (this.inBounds(x, y, z)) {
      this.data[x][y][z].instanceId = instanceId;
    }
  }

  /**
   * Checks if the (x, y, z) coordinates are within bounds
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  inBounds(x: number, y: number, z: number): boolean {
    if (
      x >= 0 &&
      x < this.size.width &&
      y >= 0 &&
      y < this.size.height &&
      z >= 0 &&
      z < this.size.width
    ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Returns true if this block is completely hidden by other blocks
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  isBlockObscured(x: number, y: number, z: number): boolean {
    const up = this.getBlock(x, y + 1, z)?.id ?? blocks.empty.id;
    const down = this.getBlock(x, y - 1, z)?.id ?? blocks.empty.id;
    const left = this.getBlock(x + 1, y, z)?.id ?? blocks.empty.id;
    const right = this.getBlock(x - 1, y, z)?.id ?? blocks.empty.id;
    const forward = this.getBlock(x, y, z + 1)?.id ?? blocks.empty.id;
    const back = this.getBlock(x, y, z - 1)?.id ?? blocks.empty.id;

    // If any of the block's sides is exposed, it is not obscured
    if (
      up === blocks.empty.id ||
      down === blocks.empty.id ||
      left === blocks.empty.id ||
      right === blocks.empty.id ||
      forward === blocks.empty.id ||
      back === blocks.empty.id
    ) {
      return false;
    } else {
      return true;
    }
  }

  disposeChildren() {
    this.traverse((obj) => {
      // @ts-ignore
      if (obj.dispose) obj.dispose();
    });
    this.clear();
  }
}
