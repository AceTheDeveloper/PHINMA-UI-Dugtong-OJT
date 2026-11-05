import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// The real public/sw.js, run in a sandbox with a fake cache and a fake network
// (ticket-35). These tests prove what the worker is allowed to keep and answer:
// only the offline page, the icons, and the build's static files; never a page,
// data, or anything behind sign-in.

const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const origin = "https://dugtong.test";

type Handler = (event: Record<string, unknown>) => void;

function absolute(input: unknown): string {
  const text = typeof input === "string" ? input : (input as { url: string }).url;
  return new URL(text, origin).href;
}

function setup(version = "b1") {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Map<string, Response>>();
  const skipWaiting = vi.fn(async () => {});
  const claim = vi.fn(async () => {});

  function cacheNamed(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      put: async (key: unknown, response: Response) => void entries.set(absolute(key), response),
    };
  }
  const caches = {
    open: async (name: string) => cacheNamed(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (key: unknown) => {
      for (const entries of store.values()) {
        const hit = entries.get(absolute(key));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };

  // The network: a page that answers, or no signal.
  const network = { online: true, requests: [] as string[] };
  const fetchImpl = vi.fn(async (input: unknown) => {
    const url = absolute(input);
    network.requests.push(new URL(url).pathname);
    if (!network.online) throw new TypeError("Failed to fetch");
    return new Response(`body of ${new URL(url).pathname}`, { status: 200 });
  });

  const self = {
    location: { href: `${origin}/sw.js?v=${version}`, origin },
    addEventListener: (type: string, handler: Handler) => void (handlers[type] = handler),
    skipWaiting,
    clients: { claim },
  };
  runInNewContext(source, { self, caches, fetch: fetchImpl, URL, Response });

  async function run(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = [];
    handlers[type]({ ...extra, waitUntil: (promise: Promise<unknown>) => void waits.push(promise) });
    await Promise.all(waits);
  }

  // A fetch event. `answered` is the response the worker gave, or null when it
  // left the request to the browser.
  async function request(path: string, init: { method?: string; mode?: string; origin?: string } = {}) {
    let answer: Promise<Response> | null = null;
    handlers.fetch({
      request: {
        method: init.method ?? "GET",
        mode: init.mode ?? "cors",
        url: `${init.origin ?? origin}${path}`,
      },
      respondWith: (promise: Promise<Response>) => void (answer = promise),
    });
    return answer === null ? null : await (answer as Promise<Response>);
  }

  const cacheNames = () => [...store.keys()];
  const cachedPaths = (name: string) => [...(store.get(name)?.keys() ?? [])].map((key) => new URL(key).pathname);
  const allCachedPaths = () => [...store.keys()].flatMap(cachedPaths);

  return { run, request, store, network, fetchImpl, skipWaiting, claim, cacheNames, cachedPaths, allCachedPaths, cacheNamed };
}

async function installed(version?: string) {
  const worker = setup(version);
  await worker.run("install");
  return worker;
}

describe("install", () => {
  it("keeps the offline page and the icons in a cache named for the build, and takes over at once", async () => {
    const worker = await installed("b1");
    expect(worker.cacheNames()).toEqual(["dugtong-static-b1"]);
    expect(worker.cachedPaths("dugtong-static-b1").sort()).toEqual(
      ["/icons/icon-192.png", "/icons/icon-512.png", "/offline"].sort(),
    );
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it("also keeps the build files the offline page names, so it works with no signal", async () => {
    const worker = setup();
    const html =
      '<link rel="stylesheet" href="/_next/static/css/app-1.css"/>' +
      '<link rel="preload" href="/_next/static/media/plex.woff2" as="font"/>' +
      '<script src="/_next/static/chunks/main-9.js" async></script>' +
      '<script>self.__x=["/_next/static/chunks/main-9.js"]</script><a href="/other">x</a>';
    worker.fetchImpl.mockImplementation(async (input: unknown) => {
      const path = new URL(absolute(input)).pathname;
      worker.network.requests.push(path);
      return new Response(path === "/offline" ? html : `body of ${path}`, { status: 200 });
    });
    await worker.run("install");
    expect(worker.cachedPaths("dugtong-static-b1").sort()).toEqual(
      [
        "/_next/static/chunks/main-9.js",
        "/_next/static/css/app-1.css",
        "/_next/static/media/plex.woff2",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/offline",
      ].sort(),
    );
    // each build file is asked for once, and the page's other links are left alone
    expect(worker.network.requests.filter((path) => path === "/_next/static/chunks/main-9.js")).toHaveLength(1);
    expect(worker.allCachedPaths()).not.toContain("/other");
    // and they are served with no signal
    worker.network.online = false;
    expect(await (await worker.request("/_next/static/css/app-1.css"))?.text()).toBe(
      "body of /_next/static/css/app-1.css",
    );
  });

  it("still keeps the offline page when one of its build files cannot be fetched", async () => {
    const worker = setup();
    worker.fetchImpl.mockImplementation(async (input: unknown) => {
      const path = new URL(absolute(input)).pathname;
      if (path === "/_next/static/css/missing.css") return new Response("no", { status: 404 });
      return new Response(
        path === "/offline" ? '<link href="/_next/static/css/missing.css"/>' : "ok",
        { status: 200 },
      );
    });
    await worker.run("install");
    expect(worker.allCachedPaths()).toContain("/offline");
    expect(worker.allCachedPaths()).not.toContain("/_next/static/css/missing.css");
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it("names its cache from the version in its own address, so a new build is a new cache", async () => {
    expect((await installed("c9")).cacheNames()).toEqual(["dugtong-static-c9"]);
  });

  it("does not keep a redirect or an error, and still installs", async () => {
    const worker = setup();
    worker.fetchImpl.mockImplementation(async () => {
      const redirected = new Response("moved", { status: 200 });
      Object.defineProperty(redirected, "redirected", { value: true });
      return redirected;
    });
    await worker.run("install");
    expect(worker.allCachedPaths()).toEqual([]);
    expect(worker.skipWaiting).toHaveBeenCalled();

    worker.fetchImpl.mockImplementation(async () => new Response("no", { status: 404 }));
    await worker.run("install");
    expect(worker.allCachedPaths()).toEqual([]);
  });

  it("still installs with no signal", async () => {
    const worker = setup();
    worker.network.online = false;
    await worker.run("install");
    expect(worker.skipWaiting).toHaveBeenCalled();
  });
});

describe("activate", () => {
  it("deletes the caches of older builds, keeps its own and other sites' caches", async () => {
    const worker = await installed("b2");
    await worker.cacheNamed("dugtong-static-b1");
    await worker.cacheNamed("someone-elses-cache");
    await worker.run("activate");
    expect(worker.cacheNames().sort()).toEqual(["dugtong-static-b2", "someone-elses-cache"]);
    expect(worker.claim).toHaveBeenCalled();
  });
});

describe("clearing on sign-out", () => {
  it("deletes every Dugtong cache, then puts back only the offline page and icons", async () => {
    const worker = await installed("b1");
    const cache = await worker.cacheNamed("dugtong-static-old");
    await cache.put("/student/logs", new Response("a student's journal"));
    await worker.cacheNamed("someone-elses-cache");

    await worker.run("message", { data: { type: "clear-caches" } });

    expect(worker.cacheNames().sort()).toEqual(["dugtong-static-b1", "someone-elses-cache"]);
    expect(worker.allCachedPaths().sort()).toEqual(
      ["/icons/icon-192.png", "/icons/icon-512.png", "/offline"].sort(),
    );
  });

  it("ignores other messages", async () => {
    const worker = await installed("b1");
    const cache = await worker.cacheNamed("dugtong-static-old");
    await cache.put("/x", new Response("x"));
    await worker.run("message", { data: { type: "something-else" } });
    await worker.run("message", { data: null });
    expect(worker.cacheNames()).toContain("dugtong-static-old");
  });
});

describe("fetch: what it never touches", () => {
  it.each(["POST", "PUT", "DELETE"])("leaves a %s to the browser", async (method) => {
    const worker = await installed();
    expect(await worker.request("/student", { method, mode: "navigate" })).toBeNull();
  });

  it("leaves other sites to the browser (Clerk, fonts)", async () => {
    const worker = await installed();
    expect(await worker.request("/v1/client", { origin: "https://clerk.example.com" })).toBeNull();
    expect(
      await worker.request("/_next/static/app.js", { origin: "https://cdn.example.com" }),
    ).toBeNull();
  });

  it("leaves the sign-in screens to the browser, even with no signal", async () => {
    const worker = await installed();
    worker.network.online = false;
    for (const path of ["/sign-in", "/sign-in/sso-callback"]) {
      expect(await worker.request(path, { mode: "navigate" })).toBeNull();
    }
  });

  it("leaves data and file requests to the network, whatever they are", async () => {
    const worker = await installed();
    for (const path of ["/api/anything", "/student/logs?_rsc=abc", "/dtr/1/pdf", "/coordinator/export"]) {
      expect(await worker.request(path, { mode: "cors" })).toBeNull();
      expect(await worker.request(path, { mode: "no-cors" })).toBeNull();
    }
    expect(worker.fetchImpl).toHaveBeenCalledTimes(3); // only the install's own fetches
  });
});

describe("fetch: pages", () => {
  const pages = ["/", "/student", "/student/logs", "/supervisor/approvals", "/coordinator", "/admin/people"];

  it("always asks the network, and keeps nothing from the answer", async () => {
    const worker = await installed();
    const before = worker.allCachedPaths().sort();
    for (const path of pages) {
      const response = await worker.request(path, { mode: "navigate" });
      expect(await response?.text()).toBe(`body of ${path}`);
    }
    expect(worker.allCachedPaths().sort()).toEqual(before);
  });

  it("shows the offline page with no signal", async () => {
    const worker = await installed();
    worker.network.online = false;
    for (const path of pages) {
      const response = await worker.request(path, { mode: "navigate" });
      expect(await response?.text()).toBe("body of /offline");
    }
  });

  it("never serves a signed-in page from the cache, even one that got in", async () => {
    const worker = await installed();
    const cache = await worker.cacheNamed("dugtong-static-b1");
    await cache.put("/student/logs", new Response("a student's journal"));
    // online: the network answers
    expect(await (await worker.request("/student/logs", { mode: "navigate" }))?.text()).toBe(
      "body of /student/logs",
    );
    // offline: the offline page answers, not the journal
    worker.network.online = false;
    const offline = await (await worker.request("/student/logs", { mode: "navigate" }))?.text();
    expect(offline).toBe("body of /offline");
    expect(offline).not.toContain("journal");
  });

  it("says so in plain text when the offline page was never kept", async () => {
    const worker = setup();
    worker.network.online = false;
    const response = await worker.request("/student", { mode: "navigate" });
    expect(response?.status).toBe(503);
    expect(await response?.text()).toBe("You're offline. Time in and approvals need a connection.");
  });
});

describe("fetch: static files", () => {
  it("keeps a build file after the first request and serves it without the network after that", async () => {
    const worker = await installed();
    const first = await worker.request("/_next/static/chunks/app-1a2b.js");
    expect(await first?.text()).toBe("body of /_next/static/chunks/app-1a2b.js");
    await Promise.resolve();
    expect(worker.allCachedPaths()).toContain("/_next/static/chunks/app-1a2b.js");

    worker.network.online = false;
    const again = await worker.request("/_next/static/chunks/app-1a2b.js");
    expect(await again?.text()).toBe("body of /_next/static/chunks/app-1a2b.js");
  });

  it("does not keep a failed build file", async () => {
    const worker = await installed();
    worker.fetchImpl.mockImplementation(async () => new Response("missing", { status: 404 }));
    const response = await worker.request("/_next/static/chunks/gone.js");
    expect(response?.status).toBe(404);
    await Promise.resolve();
    expect(worker.allCachedPaths()).not.toContain("/_next/static/chunks/gone.js");
  });

  it("serves the icons from the cache", async () => {
    const worker = await installed();
    worker.network.online = false;
    expect(await (await worker.request("/icons/icon-192.png"))?.text()).toBe("body of /icons/icon-192.png");
  });
});
