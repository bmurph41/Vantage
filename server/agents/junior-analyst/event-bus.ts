import { EventEmitter } from 'events';
import type { JaEventMap } from './types';

class TypedEventBus extends EventEmitter {
  emit<K extends keyof JaEventMap>(event: K, payload: JaEventMap[K]): boolean {
    return super.emit(event as string, payload);
  }
  on<K extends keyof JaEventMap>(event: K, listener: (payload: JaEventMap[K]) => void): this {
    return super.on(event as string, listener);
  }
  off<K extends keyof JaEventMap>(event: K, listener: (payload: JaEventMap[K]) => void): this {
    return super.off(event as string, listener);
  }
}

export const jaBus = new TypedEventBus();
jaBus.setMaxListeners(50);
