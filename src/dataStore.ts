export class DataStore {
    data: { [key: string]: number };

  constructor() {
    this.data = {};
  }

  clear() {
    this.data = {};
  }

  contains(chunkX: number, chunkZ: number, blockX: number, blockY: number, blockZ: number) {
    const key = this.#getKey(chunkX, chunkZ, blockX, blockY, blockZ);
    return this.data[key] !== undefined;
  }

  get(chunkX: number, chunkZ: number, blockX: number, blockY: number, blockZ: number) {
    const key = this.#getKey(chunkX, chunkZ, blockX, blockY, blockZ);
    const blockId = this.data[key];
    console.log(`getting value ${blockId} at key ${key}`);
    return blockId;
  }

  set(chunkX: number, chunkZ: number, blockX: number, blockY: number, blockZ: number, blockId: number) {
    const key = this.#getKey(chunkX, chunkZ, blockX, blockY, blockZ);
    this.data[key] = blockId;
    console.log(`setting key ${key} to ${blockId}`)
  }

  #getKey(chunkX: number, chunkZ: number, blockX: number, blockY: number, blockZ: number): string {
    return `${chunkX},${chunkZ},${blockX},${blockY},${blockZ}`;
  }
}