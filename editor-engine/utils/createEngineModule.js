export function createEngineModule({ name, domain, responsibilities = [], state = {} }) {
  const listeners = new Map();

  function emit(event, payload) {
    const callbacks = listeners.get(event) ?? [];
    callbacks.forEach((callback) => callback(payload));
  }

  return {
    name,
    domain,
    responsibilities,
    state: { ...state },
    on(event, callback) {
      const callbacks = listeners.get(event) ?? [];
      callbacks.push(callback);
      listeners.set(event, callbacks);
      return () => listeners.set(event, callbacks.filter((item) => item !== callback));
    },
    emit,
    configure(nextState = {}) {
      Object.assign(this.state, nextState);
      emit("configure", this.state);
      return this.state;
    },
    reset() {
      this.state = { ...state };
      emit("reset", this.state);
      return this.state;
    },
  };
}
