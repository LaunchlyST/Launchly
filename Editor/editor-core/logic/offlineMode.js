import { createEngineModule } from "../utils/createEngineModule.js";

export function createOfflineMode(input = {}) {
  const module = createEngineModule({
    name: "offlineMode",
    domain: "sync",
    responsibilities: ["track local offline state", "explain sync pause reasons", "resume queued work when online"],
    state: {
      offline: Boolean(input.offline),
      reason: input.reason ?? "",
      since: input.since ?? null,
      lastOnlineAt: input.lastOnlineAt ?? new Date().toISOString(),
    },
  });

  return {
    ...module,
    setOffline(reason = "Manual offline mode") {
      this.state.offline = true;
      this.state.reason = reason;
      this.state.since = this.state.since ?? new Date().toISOString();
      this.emit("offline:change", this.state);
      return this.state;
    },
    setOnline() {
      this.state.offline = false;
      this.state.reason = "";
      this.state.since = null;
      this.state.lastOnlineAt = new Date().toISOString();
      this.emit("offline:change", this.state);
      return this.state;
    },
    toggle(reason = "Manual offline mode") {
      return this.state.offline ? this.setOnline() : this.setOffline(reason);
    },
  };
}
