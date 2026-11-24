import { h as setContext, m as getContext } from "./server2.js";
import "./index-server.js";
// node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/subscribable.js
/**
* The base class behind everything in Query that you can subscribe to: `QueryCache`, `MutationCache`,
* the observers, and the `FocusManager`/`OnlineManager` behind `focusManager` and `onlineManager`.
* Subclasses decide what a listener receives and when it is called.
*/
var Subscribable = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
		this.subscribe = this.subscribe.bind(this);
	}
	/**
	* Registers a listener to be called on every update this object notifies about. Returns a function
	* that removes the listener again — call it to stop listening. The base class never drops a listener
	* on its own, though some subclasses clear all of theirs in `destroy()`.
	* @param listener - Called on each update, with whatever the subclass passes to its subscribers.
	* @returns A function that removes the listener.
	* @example
	* ```ts
	* const unsubscribe = subscribable.subscribe(() => {
	*   // react to the update
	* })
	*
	* unsubscribe()
	* ```
	*/
	subscribe(listener) {
		this.listeners.add(listener);
		this.onSubscribe();
		return () => {
			this.listeners.delete(listener);
			this.onUnsubscribe();
		};
	}
	/**
	* Returns `true` while at least one listener is registered, `false` once they have all unsubscribed.
	* @returns `true` if at least one listener is registered.
	*/
	hasListeners() {
		return this.listeners.size > 0;
	}
	/**
	* Called after a listener is added. Does nothing here; subclasses override it, e.g. to start
	* tracking what they observe once the first listener subscribes.
	*/
	onSubscribe() {}
	/**
	* Called after a listener is removed. Does nothing here; subclasses override it, e.g. to clean up
	* once the last listener unsubscribes.
	*/
	onUnsubscribe() {}
};
// node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/onlineManager.js
/**
* The `OnlineManager` manages the online state within TanStack Query. It can
* be used to change the default event listeners or to manually change the
* online state.
*
* By default, the `onlineManager` assumes an active network connection, and
* listens to the `online` and `offline` events on the `window` object to
* detect changes.
*/
var OnlineManager = class extends Subscribable {
	#online = true;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onOnline) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const onlineListener = () => onOnline(true);
				const offlineListener = () => onOnline(false);
				window.addEventListener("online", onlineListener, false);
				window.addEventListener("offline", offlineListener, false);
				return () => {
					window.removeEventListener("online", onlineListener);
					window.removeEventListener("offline", offlineListener);
				};
			}
		};
	}
	onSubscribe() {
		if (!this.#cleanup) this.setEventListener(this.#setup);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) {
			this.#cleanup?.();
			this.#cleanup = void 0;
		}
	}
	/**
	* `setEventListener` can be used to set a custom event listener that will
	* be used to determine the online state. The provided `setup` function
	* receives a `setOnline` callback that should be called with a `boolean`
	* whenever the online state changes.
	* @param setup - Receives the `setOnline` callback, registers the event listener, and may return
	* a cleanup function that is called when the listener is replaced or no longer needed.
	* @example
	* ```ts
	* import NetInfo from '@react-native-community/netinfo'
	* import { onlineManager } from '@tanstack/query-core'
	*
	* onlineManager.setEventListener((setOnline) => {
	*   return NetInfo.addEventListener((state) => {
	*     setOnline(!!state.isConnected)
	*   })
	* })
	* ```
	*/
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup(this.setOnline.bind(this));
	}
	/**
	* `setOnline` can be used to manually set the online state.
	* @param online - The online state.
	* @example
	* ```ts
	* import { onlineManager } from '@tanstack/query-core'
	*
	* // Set to online
	* onlineManager.setOnline(true)
	*
	* // Set to offline
	* onlineManager.setOnline(false)
	* ```
	*/
	setOnline(online) {
		if (this.#online !== online) {
			this.#online = online;
			this.listeners.forEach((listener) => {
				listener(online);
			});
		}
	}
	/**
	* `isOnline` can be used to get the current online state.
	* @returns `true` if online.
	*/
	isOnline() {
		return this.#online;
	}
};
/**
* Singleton instance of {@link OnlineManager}, used to manage and observe the online state within TanStack Query.
*/
var onlineManager = new OnlineManager();
// node_modules/.pnpm/@tanstack+svelte-query@6.3.7_svelte@5.57.3_@typescript-eslint+types@8.72.1_/node_modules/@tanstack/svelte-query/dist/context.js
var _contextKey = Symbol("QueryClient");
/**
* Retrieves the `QueryClient` set on Svelte's context by `QueryClientProvider` (or by
* {@link setQueryClientContext} directly). This is what {@link useQueryClient} calls internally.
* @returns The `QueryClient` set on context, whether by `QueryClientProvider` or {@link setQueryClientContext}.
* @throws {Error} If no `QueryClient` was found in context.
*/
var getQueryClientContext = () => {
	const client = getContext(_contextKey);
	if (!client) throw new Error("No QueryClient was found in Svelte context. Did you forget to wrap your component with QueryClientProvider?");
	return client;
};
/**
* Sets a `QueryClient` on Svelte's context, so it can be read with {@link getQueryClientContext} (or
* {@link useQueryClient}) from any descendant component. `QueryClientProvider` wraps this — use it directly
* only if you need to set the client from your own component instead.
* @param client - The `QueryClient` to make available to descendant components.
* @example
* ```svelte
* <script lang="ts">
*   import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
*
*   const queryClient = new QueryClient()
* <\/script>
*
* <QueryClientProvider client={queryClient}>
*   ...
* </QueryClientProvider>
* ```
*/
var setQueryClientContext = (client) => {
	setContext(_contextKey, client);
};
var _isRestoringContextKey = Symbol("isRestoring");
/**
* Retrieves a `isRestoring` from Svelte's context.
* @returns The `isRestoring` box set on context, or a box holding `false` if none was set or the
* context is unavailable.
*/
var getIsRestoringContext = () => {
	try {
		return getContext(_isRestoringContextKey) ?? { current: false };
	} catch (error) {
		return { current: false };
	}
};
export { Subscribable as a, onlineManager as i, getQueryClientContext as n, setQueryClientContext as r, getIsRestoringContext as t };

//# sourceMappingURL=context.js.map