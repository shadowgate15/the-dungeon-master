import { a as Subscribable, i as onlineManager } from "./context.js";
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/timeoutManager.js
var defaultTimeoutProvider = {
	setTimeout: (callback, delay) => setTimeout(callback, delay),
	clearTimeout: (timeoutId) => clearTimeout(timeoutId),
	setInterval: (callback, delay) => setInterval(callback, delay),
	clearInterval: (intervalId) => clearInterval(intervalId)
};
/**
* Allows customization of how timeouts are created.
*
* `@tanstack/query-core` makes liberal use of timeouts to implement `staleTime`
* and `gcTime`. The default TimeoutManager provider uses the platform's global
* `setTimeout` implementation, which is known to have scalability issues with
* thousands of timeouts on the event loop.
*
* If you hit this limitation, consider providing a custom TimeoutProvider that
* coalesces timeouts.
*/
var TimeoutManager = class {
	#provider = defaultTimeoutProvider;
	#providerCalled = false;
	/**
	* `setTimeoutProvider` can be used to set a custom implementation of the
	* `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` functions,
	* called a `TimeoutProvider`.
	*
	* This may be useful if you notice event loop performance issues with
	* thousands of queries. A custom TimeoutProvider could also support timer
	* delays longer than the global `setTimeout` maximum delay value of about
	* 24 days.
	*
	* It is important to call `setTimeoutProvider` before creating a
	* QueryClient or queries, so that the same provider is used consistently
	* for all timers in the application, since different TimeoutProviders
	* cannot cancel each others' timers.
	* @param provider - The `TimeoutProvider` to use for all timers from now on.
	* @example
	* ```ts
	* import { timeoutManager, QueryClient } from '@tanstack/query-core'
	* import { CustomTimeoutProvider } from './CustomTimeoutProvider'
	*
	* timeoutManager.setTimeoutProvider(new CustomTimeoutProvider())
	*
	* export const queryClient = new QueryClient()
	* ```
	*/
	setTimeoutProvider(provider) {
		if (process.env.NODE_ENV !== "production") {
			if (this.#providerCalled && provider !== this.#provider) console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, {
				previous: this.#provider,
				provider
			});
		}
		this.#provider = provider;
		if (process.env.NODE_ENV !== "production") this.#providerCalled = false;
	}
	/**
	* `setTimeout` schedules a callback to run after approximately `delay`
	* milliseconds, like the global `setTimeout` function. The callback can be
	* canceled with `clearTimeout`.
	*
	* It returns a timer ID, which may be a number or an object that can be
	* coerced to a number via `Symbol.toPrimitive`.
	* @param callback - The function to call when the timeout elapses.
	* @param delay - The time to wait before calling `callback`, in milliseconds.
	* @returns The timer ID, to pass to {@link TimeoutManager#clearTimeout}.
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const timeoutId = timeoutManager.setTimeout(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* const timeoutIdNumber: number = Number(timeoutId)
	* ```
	*/
	setTimeout(callback, delay) {
		if (process.env.NODE_ENV !== "production") this.#providerCalled = true;
		return this.#provider.setTimeout(callback, delay);
	}
	/**
	* `clearTimeout` cancels a timeout callback scheduled with `setTimeout`,
	* like the global `clearTimeout` function. It should be called with a
	* timer ID returned by `setTimeout`.
	* @param timeoutId - The timer ID returned by `setTimeout`, or `undefined`.
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const timeoutId = timeoutManager.setTimeout(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* timeoutManager.clearTimeout(timeoutId)
	* ```
	*/
	clearTimeout(timeoutId) {
		this.#provider.clearTimeout(timeoutId);
	}
	/**
	* `setInterval` schedules a callback to be called approximately every
	* `delay` milliseconds, like the global `setInterval` function.
	*
	* Like `setTimeout`, it returns a timer ID, which may be a number or an
	* object that can be coerced to a number via `Symbol.toPrimitive`.
	* @param callback - The function to call on every interval.
	* @param delay - The time between calls, in milliseconds.
	* @returns The timer ID, to pass to {@link TimeoutManager#clearInterval}.
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const intervalId = timeoutManager.setInterval(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	* ```
	*/
	setInterval(callback, delay) {
		if (process.env.NODE_ENV !== "production") this.#providerCalled = true;
		return this.#provider.setInterval(callback, delay);
	}
	/**
	* `clearInterval` can be used to cancel an interval, like the global
	* `clearInterval` function. It should be called with an interval ID
	* returned by `setInterval`.
	* @param intervalId - The timer ID returned by `setInterval`, or `undefined`.
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const intervalId = timeoutManager.setInterval(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* timeoutManager.clearInterval(intervalId)
	* ```
	*/
	clearInterval(intervalId) {
		this.#provider.clearInterval(intervalId);
	}
};
/**
* Singleton instance of {@link TimeoutManager}, used throughout TanStack Query to schedule and cancel timers.
*/
var timeoutManager = new TimeoutManager();
/**
* In many cases code wants to delay to the next event loop tick; this is not
* mediated by {@link timeoutManager}.
*
* This function is provided to make auditing the `tanstack/query-core` for
* incorrect use of system `setTimeout` easier.
* @param callback - The function to call on the next event loop tick.
*/
function systemSetTimeoutZero(callback) {
	setTimeout(callback, 0);
}
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/utils.js
/**
* @deprecated use `environmentManager.isServer()` instead.
*/
var isServer$1 = typeof window === "undefined" || "Deno" in globalThis;
function noop() {}
/**
* Resolves an {@link Updater}: calls it with `input` if it is a function, otherwise returns it as
* is.
* @param updater - The new value, or a function that receives `input` and returns the new value.
* @param input - The current value, passed to `updater` if it is a function.
* @returns The new value.
*/
function functionalUpdate(updater, input) {
	return typeof updater === "function" ? updater(input) : updater;
}
/**
* Checks whether a value can be used as a timeout: a non-negative, finite number.
* @param value - The value to check.
* @returns `true` if `value` is a number that is `>= 0` and not `Infinity`.
*/
function isValidTimeout(value) {
	return typeof value === "number" && value >= 0 && value !== Infinity;
}
/**
* Calculates how long until data updated at `updatedAt` becomes stale.
* @param updatedAt - The timestamp, in milliseconds, at which the data was last updated.
* @param staleTime - The time, in milliseconds, after which data is considered stale. Defaults to
* `0`.
* @returns The remaining time in milliseconds, or `0` if the data is already stale.
*/
function timeUntilStale(updatedAt, staleTime) {
	return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
/**
* Resolves an option that can be given either as a value or as a function of the query, such as
* `staleTime`.
* @param value - The option value, or a function that receives `query` and returns the value.
* @param query - The query passed to `value` if it is a function.
* @returns The resolved value, or `undefined` if `value` is `undefined`.
*/
function resolveQueryValue(value, query) {
	return typeof value === "function" ? value(query) : value;
}
/**
* Checks whether a query matches the given {@link QueryFilters}.
* Every filter that is specified must match; filters that are left unspecified are ignored.
* @param filters - The filters to check the query against.
* @param query - The query to check.
* @returns `true` if the query matches every specified filter.
* @example
* ```ts
* const queryCache = queryClient.getQueryCache()
*
* const matchingQueries = queryCache
*   .getAll()
*   .filter((query) => matchQuery({ queryKey: ['posts'] }, query))
* ```
*/
function matchQuery(filters, query) {
	const { type = "all", exact, fetchStatus, predicate, queryKey, stale } = filters;
	if (queryKey) {
		if (exact) {
			if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) return false;
		} else if (!partialMatchKey(query.queryKey, queryKey)) return false;
	}
	if (type !== "all") {
		const isActive = query.isActive();
		if (type === "active" && !isActive) return false;
		if (type === "inactive" && isActive) return false;
	}
	if (typeof stale === "boolean" && query.isStale() !== stale) return false;
	if (fetchStatus && fetchStatus !== query.state.fetchStatus) return false;
	if (predicate && !predicate(query)) return false;
	return true;
}
/**
* Checks whether a mutation matches the given {@link MutationFilters}.
* Every filter that is specified must match; filters that are left unspecified are ignored.
* If a `mutationKey` filter is provided but the mutation has no `mutationKey` of its own, it does not match.
* @param filters - The filters to check the mutation against.
* @param mutation - The mutation to check.
* @returns `true` if the mutation matches every specified filter.
* @example
* ```ts
* const mutationCache = queryClient.getMutationCache()
*
* const matchingMutations = mutationCache
*   .getAll()
*   .filter((mutation) => matchMutation({ mutationKey: ['addPost'] }, mutation))
* ```
*/
function matchMutation(filters, mutation) {
	const { exact, status, predicate, mutationKey } = filters;
	if (mutationKey) {
		if (!mutation.options.mutationKey) return false;
		if (exact) {
			if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) return false;
		} else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) return false;
	}
	if (status && mutation.state.status !== status) return false;
	if (predicate && !predicate(mutation)) return false;
	return true;
}
/**
* Hashes a query key with the query's `queryKeyHashFn` option, falling back to {@link hashKey}.
* @param queryKey - The query key to hash.
* @param options - The query options that may provide a custom `queryKeyHashFn`.
* @returns The query hash, a string that identifies the query in the cache.
*/
function hashQueryKeyByOptions(queryKey, options) {
	return (options?.queryKeyHashFn || hashKey)(queryKey);
}
/**
* Default query & mutation keys hash function.
* Hashes the value into a stable hash.
* @param queryKey - The query or mutation key to hash.
* @returns The stable hash of the key, as a JSON string.
* @example
* ```ts
* // Object keys are sorted, so key order doesn't affect the hash:
* hashKey(['todos', { page: 1, filter: 'done' }]) // === '["todos",{"filter":"done","page":1}]'
* ```
*/
function hashKey(queryKey) {
	return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
		result[key] = val[key];
		return result;
	}, {}) : val);
}
function partialMatchKey(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a && b && typeof a === "object" && typeof b === "object") {
		if (Array.isArray(a) && Array.isArray(b)) {
			if (b.length > a.length) return false;
			for (let i = 0; i < b.length; i++) if (!partialMatchKey(a[i], b[i])) return false;
			return true;
		}
		const bKeys = Object.keys(b);
		for (const key of bKeys) if (!partialMatchKey(a[key], b[key])) return false;
		return true;
	}
	return false;
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b, depth = 0) {
	if (a === b) return a;
	if (depth > 500) return b;
	const array = isPlainArray(a) && isPlainArray(b);
	if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
	const aSize = (array ? a : Object.keys(a)).length;
	const bItems = array ? b : Object.keys(b);
	const bSize = bItems.length;
	const copy = array ? new Array(bSize) : {};
	let equalItems = 0;
	for (let i = 0; i < bSize; i++) {
		const key = array ? i : bItems[i];
		const aItem = a[key];
		const bItem = b[key];
		if (aItem === bItem) {
			copy[key] = aItem;
			if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
			continue;
		}
		if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
			copy[key] = bItem;
			continue;
		}
		const v = replaceEqualDeep(aItem, bItem, depth + 1);
		copy[key] = v;
		if (v === aItem) equalItems++;
	}
	return aSize === bSize && equalItems === aSize ? a : copy;
}
/**
* Shallow compare objects.
* @param a - The first object.
* @param b - The second object, or `undefined`.
* @returns `true` if both objects have the same keys, with strictly equal values for each key.
*/
function shallowEqualObjects(a, b) {
	if (!b || Object.keys(a).length !== Object.keys(b).length) return false;
	for (const key in a) if (a[key] !== b[key]) return false;
	return true;
}
/**
* Checks whether a value is an array with no holes and no extra properties.
* @param value - The value to check.
* @returns `true` if `value` is an array whose number of own keys equals its `length`.
*/
function isPlainArray(value) {
	return Array.isArray(value) && value.length === Object.keys(value).length;
}
/**
* Checks whether a value is a plain object, e.g. created with an object literal or
* `Object.create(null)`.
* @param o - The value to check.
* @returns `true` if `o` is a plain object.
*/
function isPlainObject(o) {
	if (!hasObjectPrototype(o)) return false;
	const objectPrototype = Object.getPrototypeOf(o);
	const ctor = objectPrototype?.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return false;
	const prot = ctor.prototype;
	if (!hasObjectPrototype(prot)) return false;
	if (!prot.hasOwnProperty("isPrototypeOf")) return false;
	if (objectPrototype !== Object.prototype) return false;
	return true;
}
/**
* Checks whether a value's `Object.prototype.toString` tag is `[object Object]`.
* @param o - The value to check.
* @returns `true` if the tag is `[object Object]`.
*/
function hasObjectPrototype(o) {
	return Object.prototype.toString.call(o) === "[object Object]";
}
/**
* Waits for the given time, using the configured {@link timeoutManager}.
* @param timeout - The time to wait, in milliseconds.
* @returns A promise that resolves after `timeout` milliseconds.
*/
function sleep(timeout) {
	return new Promise((resolve) => {
		timeoutManager.setTimeout(resolve, timeout);
	});
}
/**
* Applies a query's `structuralSharing` option when writing new data.
* @param prevData - The previously cached data.
* @param data - The new data.
* @param options - The query options, whose `structuralSharing` decides how the data is merged.
* @returns The result of a custom `structuralSharing` function, `data` with its unchanged parts
* replaced by those of `prevData` by default, or `data` as is if `structuralSharing` is `false`.
* @throws {Error} The error from the default structural sharing, e.g. when the data is not JSON serializable.
* Outside production, it is also logged to the console.
*/
function replaceData(prevData, data, options) {
	if (typeof options.structuralSharing === "function") return options.structuralSharing(prevData, data);
	else if (options.structuralSharing !== false) {
		if (process.env.NODE_ENV !== "production") try {
			return replaceEqualDeep(prevData, data);
		} catch (error) {
			console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
			throw error;
		}
		return replaceEqualDeep(prevData, data);
	}
	return data;
}
/**
* Returns a new array with `item` added at the end. If that makes the array longer than `max`,
* the first item is dropped. Only one item is dropped, so the result can still exceed `max` if
* `items` already did.
* @param items - The current items.
* @param item - The value to append.
* @param max - The length above which an item is dropped. `0` (the default) means no limit.
* @returns A new array with `item` added.
*/
function addToEnd(items, item, max = 0) {
	const newItems = [...items, item];
	return max && newItems.length > max ? newItems.slice(1) : newItems;
}
/**
* Returns a new array with `item` added at the start. If that makes the array longer than `max`,
* the last item is dropped. Only one item is dropped, so the result can still exceed `max` if
* `items` already did.
* @param items - The current items.
* @param item - The value to prepend.
* @param max - The length above which an item is dropped. `0` (the default) means no limit.
* @returns A new array with `item` added.
*/
function addToStart(items, item, max = 0) {
	const newItems = [item, ...items];
	return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
}
/**
* Sentinel value that can be passed as a query's `queryFn` to conditionally disable the query (equivalent
* to `enabled: false`) while preserving full type inference for the query's data. Unlike `enabled: false`,
* a query disabled via `skipToken` cannot be triggered with `refetch`.
* @example
* ```ts
* new QueryObserver(queryClient, {
*   queryKey: ['post', postId],
*   queryFn: postId != null ? () => fetchPost(postId) : skipToken,
* })
* ```
*/
var skipToken = Symbol();
/**
* Returns the function to call for a fetch. If there is no `queryFn` but the fetch was started from
* an `initialPromise`, that promise is returned instead. If there is no usable `queryFn` (missing or
* {@link skipToken}), the returned function rejects with a `Missing queryFn` error.
* @param options - The query options with the `queryFn`, and the `queryHash` used in error messages.
* @param fetchOptions - The fetch options, which may carry an `initialPromise`.
* @returns The function to call for the fetch.
*/
function ensureQueryFn(options, fetchOptions) {
	if (process.env.NODE_ENV !== "production") {
		if (options.queryFn === skipToken) console.error(`Attempted to invoke queryFn when set to skipToken. This is likely a configuration error. Query hash: '${options.queryHash}'`);
	}
	if (!options.queryFn && fetchOptions?.initialPromise) return () => fetchOptions.initialPromise;
	if (!options.queryFn || options.queryFn === skipToken) return () => Promise.reject(/* @__PURE__ */ new Error(`Missing queryFn: '${options.queryHash}'`));
	return options.queryFn;
}
/**
* Adds a lazy `signal` getter to an object, such as a query function context. The first time
* `signal` is read, `onCancelled` is registered for the signal's `abort` event (or called right
* away if it is already aborted), so cancellation is only tracked when the signal is actually used.
* @param object - The object to add the `signal` property to.
* @param getSignal - Returns the `AbortSignal`. Called once, when `signal` is first read.
* @param onCancelled - Called when the signal is aborted, if `signal` was read.
* @returns The same object, with the `signal` property added.
*/
function addConsumeAwareSignal(object, getSignal, onCancelled) {
	let consumed = false;
	let signal;
	Object.defineProperty(object, "signal", {
		enumerable: true,
		get: () => {
			signal ??= getSignal();
			if (consumed) return signal;
			consumed = true;
			if (signal.aborted) onCancelled();
			else signal.addEventListener("abort", onCancelled, { once: true });
			return signal;
		}
	});
	return object;
}
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/environmentManager.js
var isServerFn = () => isServer$1;
/**
* Returns whether the current runtime should be treated as a server environment.
* @returns `true` if the runtime is treated as a server.
*/
var isServer = () => isServerFn();
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/focusManager.js
/**
* The `FocusManager` manages the focus state within TanStack Query.
*
* It can be used to change the default event listeners or to manually change the focus state.
*/
var FocusManager = class extends Subscribable {
	#focused;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onFocus) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const listener = () => onFocus();
				window.addEventListener("visibilitychange", listener, false);
				return () => {
					window.removeEventListener("visibilitychange", listener);
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
	* be used to determine the focus state. The provided `setup` function
	* receives a `setFocused` callback: call it with a `boolean` to manually
	* set the focus state, or with no arguments to re-evaluate the current
	* focus state and notify subscribers.
	* @param setup - Receives the `setFocused` callback, registers the event listener, and may return
	* a cleanup function that is called when the listener is replaced or no longer needed.
	* @example
	* ```ts
	* import { focusManager } from '@tanstack/query-core'
	*
	* focusManager.setEventListener((handleFocus) => {
	*   const listener = () => handleFocus()
	*   // Listen to visibilitychange
	*   if (typeof window !== 'undefined' && window.addEventListener) {
	*     window.addEventListener('visibilitychange', listener, false)
	*   }
	*
	*   return () => {
	*     // Be sure to unsubscribe if a new handler is set
	*     window.removeEventListener('visibilitychange', listener)
	*   }
	* })
	* ```
	*/
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup((focused) => {
			if (typeof focused === "boolean") this.setFocused(focused);
			else this.onFocus();
		});
	}
	/**
	* `setFocused` can be used to manually set the focus state. Set `undefined`
	* to fall back to the default focus check.
	* @param focused - The focus state, or `undefined` to use the default focus check.
	* @example
	* ```ts
	* import { focusManager } from '@tanstack/query-core'
	*
	* // Set focused
	* focusManager.setFocused(true)
	*
	* // Set unfocused
	* focusManager.setFocused(false)
	*
	* // Fallback to the default focus check
	* focusManager.setFocused(undefined)
	* ```
	*/
	setFocused(focused) {
		if (this.#focused !== focused) {
			this.#focused = focused;
			this.onFocus();
		}
	}
	/**
	* `onFocus` notifies all subscribed listeners with the current focus state.
	*/
	onFocus() {
		const isFocused = this.isFocused();
		this.listeners.forEach((listener) => {
			listener(isFocused);
		});
	}
	/**
	* `isFocused` can be used to get the current focus state.
	* @returns The focus state set with `setFocused`, or otherwise whether the document is visible.
	*/
	isFocused() {
		if (typeof this.#focused === "boolean") return this.#focused;
		return globalThis.document?.visibilityState !== "hidden";
	}
};
/**
* Singleton instance of {@link FocusManager}, used to manage and observe the focus state within TanStack Query.
*/
var focusManager = new FocusManager();
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/notifyManager.js
/**
* Default scheduling function used by the notify manager.
* Schedules the callback with the system's `setTimeout(callback, 0)`.
*/
var defaultScheduler = systemSetTimeoutZero;
/**
* Creates a notify manager, which schedules and batches notifications to subscribers. Query uses a
* single instance of it, exported as {@link notifyManager}.
* @returns A new notify manager.
*/
function createNotifyManager() {
	let queue = [];
	let transactions = 0;
	let notifyFn = (callback) => {
		callback();
	};
	let batchNotifyFn = (callback) => {
		callback();
	};
	let scheduleFn = defaultScheduler;
	const schedule = (callback) => {
		if (transactions) queue.push(callback);
		else scheduleFn(() => {
			notifyFn(callback);
		});
	};
	const flush = () => {
		const originalQueue = queue;
		queue = [];
		if (originalQueue.length) scheduleFn(() => {
			batchNotifyFn(() => {
				originalQueue.forEach((callback) => {
					notifyFn(callback);
				});
			});
		});
	};
	return {
		/**
		* Batches all updates scheduled inside the passed callback.
		* This is mainly used internally to optimize query client updating.
		* Batches can be nested; the queue is only flushed once the outermost `batch` call finishes.
		* The return value of `callback` is passed through.
		* @param callback - The function to run in the batch.
		* @returns The return value of `callback`.
		*/
		batch: (callback) => {
			let result;
			transactions++;
			try {
				result = callback();
			} finally {
				transactions--;
				if (!transactions) flush();
			}
			return result;
		},
		/**
		* All calls to the wrapped function will be batched.
		* @param callback - The function to wrap.
		* @returns A function that schedules a call to `callback` with the given arguments.
		*/
		batchCalls: (callback) => {
			return (...args) => {
				schedule(() => {
					callback(...args);
				});
			};
		},
		/**
		* Schedules a function to be run on the next batch.
		* By default, the batch is run with a `setTimeout`, but this can be configured via `setScheduler`.
		*/
		schedule,
		/**
		* Use this method to set a custom notify function.
		* This can be used to for example wrap notifications with `React.act` while running tests.
		* @param fn - Receives each notification callback and must call it.
		*/
		setNotifyFunction: (fn) => {
			notifyFn = fn;
		},
		/**
		* Use this method to set a custom function to batch notifications together into a single tick.
		* Framework adapters use this to plug in their own batching primitive, so that a single query
		* update only triggers one re-render instead of one per subscriber.
		* @param fn - Receives a function that runs a batch of notifications and must call it.
		* @example
		* ```ts
		* import { notifyManager } from '@tanstack/query-core'
		* import { batch } from 'solid-js'
		*
		* notifyManager.setBatchNotifyFunction(batch)
		* ```
		*/
		setBatchNotifyFunction: (fn) => {
			batchNotifyFn = fn;
		},
		/**
		* Configures a custom callback that schedules when the next batch runs.
		* The default behavior is `setTimeout(callback, 0)`.
		* @param fn - Receives a callback that runs the next batch, and schedules it.
		* @example
		* ```ts
		* import { notifyManager } from '@tanstack/query-core'
		*
		* // Schedule batches in the next microtask
		* notifyManager.setScheduler(queueMicrotask)
		*
		* // Schedule batches before the next frame is rendered
		* notifyManager.setScheduler(requestAnimationFrame)
		*
		* // Schedule batches some time in the future
		* notifyManager.setScheduler((cb) => setTimeout(cb, 10))
		* ```
		*/
		setScheduler: (fn) => {
			scheduleFn = fn;
		}
	};
}
/**
* Handles scheduling and batching callbacks in TanStack Query.
*/
var notifyManager = createNotifyManager();
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/retryer.js
/**
* The default `retryDelay`: doubles with every failure, starting at 1 second, up to 30 seconds.
* @param failureCount - The number of failures so far.
* @returns The delay before the next retry, in milliseconds.
*/
function defaultRetryDelay(failureCount) {
	return Math.min(1e3 * 2 ** failureCount, 3e4);
}
/**
* Checks whether a fetch can run for the given network mode.
* @param networkMode - The `networkMode` option. Defaults to `'online'`.
* @returns `true` if the network mode is not `'online'`, or if it is and the client is online.
*/
function canFetch(networkMode) {
	return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
/**
* The error thrown by a `Retryer` (and surfaced to `query.promise`/`mutation`) when a fetch is cancelled, e.g. via
* `query.cancel()`. `revert`, if `true`, tells the caller to restore the state the query was in before the fetch
* started instead of surfacing the error. `silent`, if `true`, tells the caller to suppress this error and instead
* resolve with the promise of the fetch that triggered the cancellation.
* @example
* ```ts
* query.cancel()
*
* try {
*   await query.promise
* } catch (error) {
*   if (error instanceof CancelledError) {
*     // the fetch was cancelled, e.g. via `query.cancel()`
*   }
* }
* ```
*/
var CancelledError = class extends Error {
	constructor(options) {
		super("CancelledError");
		this.revert = options?.revert;
		this.silent = options?.silent;
	}
};
/**
* Creates a retryer, which runs a function and retries it on failure according to the `retry` and
* `retryDelay` options. It pauses while the network mode doesn't allow fetching or `canRun` returns
* `false`, and can be cancelled. Queries and mutations use it to run their `queryFn` and
* `mutationFn`.
* @param config - The function to run, the retry options, and the callbacks for failures, pausing,
* continuing, and cancellation.
* @returns The retryer, whose `promise` settles with the result of the function.
*/
function createRetryer(config) {
	let isRetryCancelled = false;
	let failureCount = 0;
	let continueFn;
	let status = "pending";
	let promiseResolve;
	let promiseReject;
	const promise = new Promise((resolve, reject) => {
		promiseResolve = resolve;
		promiseReject = reject;
	});
	promise.catch(noop);
	const isResolved = () => status !== "pending";
	const cancel = (cancelOptions) => {
		if (!isResolved()) {
			const error = new CancelledError(cancelOptions);
			reject(error);
			config.onCancel?.(error);
		}
	};
	const cancelRetry = () => {
		isRetryCancelled = true;
	};
	const continueRetry = () => {
		isRetryCancelled = false;
	};
	const canContinue = () => focusManager.isFocused() && (config.networkMode === "always" || onlineManager.isOnline()) && config.canRun();
	const canStart = () => canFetch(config.networkMode) && config.canRun();
	const resolve = (value) => {
		if (!isResolved()) {
			continueFn?.();
			status = "resolved";
			promiseResolve(value);
		}
	};
	const reject = (value) => {
		if (!isResolved()) {
			continueFn?.();
			status = "rejected";
			promiseReject(value);
		}
	};
	const pause = (canResume) => {
		return new Promise((continueResolve) => {
			continueFn = (value) => {
				if (isResolved() || canResume()) continueResolve(value);
			};
			config.onPause?.();
		}).then(() => {
			continueFn = void 0;
			if (!isResolved()) config.onContinue?.();
		});
	};
	const run = () => {
		if (isResolved()) return;
		let promiseOrValue;
		const initialPromise = failureCount === 0 ? config.initialPromise : void 0;
		try {
			promiseOrValue = initialPromise ?? config.fn();
		} catch (error) {
			promiseOrValue = Promise.reject(error);
		}
		Promise.resolve(promiseOrValue).then(resolve).catch((error) => {
			if (isResolved()) return;
			const retry = config.retry ?? (isServer() ? 0 : 3);
			const retryDelay = config.retryDelay ?? defaultRetryDelay;
			const delay = typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
			const shouldRetry = retry === true || typeof retry === "number" && failureCount < retry || typeof retry === "function" && retry(failureCount, error);
			if (isRetryCancelled || !shouldRetry) {
				reject(error);
				return;
			}
			failureCount++;
			config.onFail?.(failureCount, error);
			sleep(delay).then(() => {
				return canContinue() ? void 0 : pause(canContinue);
			}).then(() => {
				if (isRetryCancelled) reject(error);
				else run();
			});
		});
	};
	return {
		promise,
		status: () => status,
		cancel,
		continue: () => {
			continueFn?.();
			return promise;
		},
		cancelRetry,
		continueRetry,
		canStart,
		start: () => {
			if (canStart()) run();
			else pause(canStart).then(run);
			return promise;
		}
	};
}
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/removable.js
/**
* The base class for cache entries that are garbage collected once nothing is using them —
* `Query` and `Mutation` both extend it. `gcTime` controls how long an unused entry is kept.
*/
var Removable = class {
	#gcTimeout;
	/**
	* Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
	* A subclass may override this to release what it holds on to as well — `Query` also cancels any
	* in-flight fetch.
	*/
	destroy() {
		this.clearGcTimeout();
	}
	/**
	* Schedules the entry to be removed from its cache after `gcTime`, replacing any timeout scheduled
	* before. Nothing is scheduled if `gcTime` is `Infinity`.
	*/
	scheduleGc() {
		this.clearGcTimeout();
		if (isValidTimeout(this.gcTime)) this.#gcTimeout = timeoutManager.setTimeout(() => {
			this.optionalRemove();
		}, this.gcTime);
	}
	/**
	* Updates `gcTime`, keeping the longest one seen so far. Without a value, it defaults to 5 minutes
	* on the client and `Infinity` on the server.
	* @param newGcTime - The `gcTime` from the latest options, if any.
	*/
	updateGcTime(newGcTime) {
		this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer() ? Infinity : 3e5));
	}
	/**
	* Cancels the scheduled removal, if there is one.
	*/
	clearGcTimeout() {
		if (this.#gcTimeout !== void 0) {
			timeoutManager.clearTimeout(this.#gcTimeout);
			this.#gcTimeout = void 0;
		}
	}
};
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/infiniteQueryBehavior.js
/**
* Creates the behavior that fetches the pages of an infinite query: the next or previous page for
* `fetchNextPage`/`fetchPreviousPage`, or all pages again from the start on a refetch.
* @param pages - The number of pages to fetch from the start when all pages are fetched again,
* e.g. from the `pages` option of `queryClient.infiniteQuery`. Defaults to the number of cached
* pages.
* @returns The query behavior to set on an infinite query.
*/
function infiniteQueryBehavior(pages) {
	return { onFetch: (context, query) => {
		const options = context.options;
		const direction = context.fetchOptions?.meta?.fetchMore?.direction;
		const oldPages = context.state.data?.pages || [];
		const oldPageParams = context.state.data?.pageParams || [];
		let result = {
			pages: [],
			pageParams: []
		};
		let currentPage = 0;
		const fetchFn = async () => {
			let cancelled = false;
			const addSignalProperty = (object) => {
				addConsumeAwareSignal(object, () => context.signal, () => cancelled = true);
			};
			const queryFn = ensureQueryFn(context.options, context.fetchOptions);
			const fetchPage = async (data, param, previous) => {
				if (cancelled) return Promise.reject(context.signal.reason);
				if (param == null && data.pages.length) return Promise.resolve(data);
				const createQueryFnContext = () => {
					const queryFnContext = {
						client: context.client,
						queryKey: context.queryKey,
						pageParam: param,
						direction: previous ? "backward" : "forward",
						meta: context.options.meta
					};
					addSignalProperty(queryFnContext);
					return queryFnContext;
				};
				const queryFnContext = createQueryFnContext();
				const page = await queryFn(queryFnContext);
				const { maxPages } = context.options;
				const addTo = previous ? addToStart : addToEnd;
				return {
					pages: addTo(data.pages, page, maxPages),
					pageParams: addTo(data.pageParams, param, maxPages)
				};
			};
			if (direction && oldPages.length) {
				const previous = direction === "backward";
				const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
				const oldData = {
					pages: oldPages,
					pageParams: oldPageParams
				};
				result = await fetchPage(oldData, pageParamFn(options, oldData), previous);
			} else {
				const remainingPages = pages ?? oldPages.length;
				do {
					const param = currentPage === 0 ? oldPageParams[0] === void 0 ? options.initialPageParam : oldPageParams[0] : getNextPageParam(options, result);
					if (currentPage > 0 && param == null) break;
					result = await fetchPage(result, param);
					currentPage++;
				} while (currentPage < remainingPages);
			}
			return result;
		};
		if (context.options.persister) context.fetchFn = () => {
			return context.options.persister?.(fetchFn, {
				client: context.client,
				queryKey: context.queryKey,
				meta: context.options.meta,
				signal: context.signal
			}, query);
		};
		else context.fetchFn = fetchFn;
	} };
}
/**
* Computes the page param of the page after the last one, with the `getNextPageParam` option.
* @param options - The infinite query options.
* @param data - The current pages and page params.
* @returns The next page param, or `undefined` if there are no pages yet.
*/
function getNextPageParam(options, { pages, pageParams }) {
	const lastIndex = pages.length - 1;
	return pages.length > 0 ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams) : void 0;
}
/**
* Computes the page param of the page before the first one, with the `getPreviousPageParam`
* option.
* @param options - The infinite query options.
* @param data - The current pages and page params.
* @returns The previous page param, or `undefined` if there are no pages yet or no
* `getPreviousPageParam` option.
*/
function getPreviousPageParam(options, { pages, pageParams }) {
	return pages.length > 0 ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams) : void 0;
}
// ../../../node_modules/.pnpm/@tanstack+query-core@5.105.1/node_modules/@tanstack/query-core/build/modern/query.js
/**
* Represents a single cached query. A `Query` holds the query's key, options,
* state (data/error/status), and the observers currently subscribed to it.
*
* Instances are created and managed internally by `QueryCache`; application
* code typically interacts with queries indirectly through `QueryClient` or
* a framework hook like `useQuery`. Direct access to a `Query` instance is
* possible via `queryCache.find()`/`findAll()` for inspecting cache state.
* @example
* ```ts
* const queryCache = queryClient.getQueryCache()
* const query = queryCache.find({ queryKey: ['posts'] })
*
* if (query) {
*   console.log(query.state.dataUpdatedAt)
* }
* ```
*/
var Query = class extends Removable {
	#queryType;
	#initialState;
	#revertState;
	#cache;
	#client;
	#retryer;
	#defaultOptions;
	#abortSignalConsumed;
	constructor(config) {
		super();
		this.#abortSignalConsumed = false;
		this.#defaultOptions = config.defaultOptions;
		this.setOptions(config.options);
		this.observers = [];
		this.#client = config.client;
		this.#cache = this.#client.getQueryCache();
		this.queryKey = config.queryKey;
		this.queryHash = config.queryHash;
		this.#initialState = getDefaultState(this.options);
		this.state = config.state ?? this.#initialState;
		this.scheduleGc();
	}
	/**
	* The `meta` object passed in the query's options, if any.
	* @returns The query's `meta`, or `undefined` if none was set.
	*/
	get meta() {
		return this.options.meta;
	}
	/**
	* `'infinite'` for an infinite query, otherwise `undefined`.
	* @internal
	* @returns The type of the query, set from the `_type` option (e.g. `'infinite'`).
	*/
	get queryType() {
		return this.#queryType;
	}
	/**
	* The promise for the currently in-flight fetch, if the query is fetching.
	* `undefined` when the query is not fetching.
	* @returns The promise of the in-flight fetch, or `undefined`.
	*/
	get promise() {
		return this.#retryer?.promise;
	}
	/**
	* Replaces the query's options and applies their `gcTime`. If the query has no data yet, it gets
	* the `initialData` from the new options, if any.
	* @internal
	* @param options - The new query options, merged on top of the query's default options.
	*/
	setOptions(options) {
		this.options = {
			...this.#defaultOptions,
			...options
		};
		if (options?._type) this.#queryType = options._type;
		this.updateGcTime(this.options.gcTime);
		if (this.state && this.state.data === void 0) {
			const defaultState = getDefaultState(this.options);
			if (defaultState.data !== void 0) {
				this.setState(successState(defaultState.data, defaultState.dataUpdatedAt));
				this.#initialState = defaultState;
			}
		}
	}
	optionalRemove() {
		if (!this.observers.length && this.state.fetchStatus === "idle") this.#cache.remove(this);
	}
	/**
	* Writes new data to the query and marks it as successfully fetched.
	* @internal
	* @param newData - The data to write. Structural sharing with the current data is applied.
	* @param options - Set `updatedAt` to override the timestamp, and `manual` to mark the write as
	* manual (e.g. from `queryClient.setQueryData`).
	* @returns The data that was written.
	*/
	setData(newData, options) {
		const data = replaceData(this.state.data, newData, this.options);
		this.#dispatch({
			data,
			type: "success",
			dataUpdatedAt: options?.updatedAt,
			manual: options?.manual
		});
		return data;
	}
	/**
	* Merges the given partial state directly into this query's state, notifying observers. Used
	* by persistence and broadcast plugins to restore a state snapshot, and by devtools to let a
	* user manually trigger a loading/error state or edit the cached data.
	* @param state - The partial state to merge into the query's state.
	*/
	setState(state) {
		this.#dispatch({
			type: "setState",
			state
		});
	}
	/**
	* Cancels the query's currently in-flight fetch, if any.
	* - Returns a promise that resolves once the cancellation has settled.
	* - If no fetch is in progress, resolves immediately.
	* @param options - Set `revert` to restore the state from before the fetch started, and `silent`
	* to suppress the cancellation error when a new fetch replaces the cancelled one.
	* @returns A promise that resolves once the cancellation has settled.
	* @example
	* ```ts
	* await query.cancel()
	* ```
	*/
	cancel(options) {
		const promise = this.#retryer?.promise;
		this.#retryer?.cancel(options);
		return promise ? promise.then(noop).catch(noop) : Promise.resolve();
	}
	/**
	* Clears the query's garbage collection timeout and silently cancels any
	* in-flight fetch. Called by `QueryCache` when the query is removed from
	* the cache.
	* @see {@link Query#cancel}
	*/
	destroy() {
		super.destroy();
		this.cancel({ silent: true });
	}
	/**
	* The state the query was created with.
	* @internal
	* @returns The state the query had when it was first created, used by {@link Query#reset}.
	*/
	get resetState() {
		return this.#initialState;
	}
	/**
	* Resets the query back to its initial state (the state it had when it was
	* first created, e.g. any `initialData`), destroying it first to cancel any
	* in-flight fetch.
	*/
	reset() {
		this.destroy();
		this.setState(this.resetState);
	}
	/**
	* Returns `true` if the query has at least one observer for which `enabled`
	* does not resolve to `false`.
	* @returns `true` if the query has an enabled observer.
	*/
	isActive() {
		return this.observers.some((observer) => resolveQueryValue(observer.options.enabled, this) !== false);
	}
	/**
	* Returns `true` if the query is disabled, meaning it will not fetch
	* automatically.
	* - If the query has observers, it is disabled when none of them are active
	*   (see `isActive`).
	* - If the query has no observers, it is disabled when its `queryFn` is
	*   `skipToken` or it has never been fetched.
	* @returns `true` if the query is disabled.
	*/
	isDisabled() {
		if (this.getObserversCount() > 0) return !this.isActive();
		return this.options.queryFn === skipToken || !this.isFetched();
	}
	/**
	* Returns `true` if the query has been fetched, i.e. it has resolved with
	* either data or an error at least once.
	* @returns `true` if the query has been fetched.
	*/
	isFetched() {
		return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
	}
	/**
	* Returns `true` if the query has at least one observer configured with
	* `staleTime: 'static'`, meaning it is treated as never stale.
	* @returns `true` if the query is static.
	*/
	isStatic() {
		if (this.getObserversCount() > 0) return this.observers.some((observer) => resolveQueryValue(observer.options.staleTime, this) === "static");
		return false;
	}
	/**
	* Returns `true` if the query is stale.
	* - If the query has observers, defers to whether any observer's current
	*   result reports `isStale` (which accounts for each observer's own
	*   `staleTime` and `enabled` state).
	* - If the query has no observers, it is considered stale when it has no
	*   data or has been invalidated.
	* @returns `true` if the query is stale.
	* @see {@link Query#isStaleByTime}
	* @example
	* ```ts
	* if (query.isStale()) {
	*   // refetch or otherwise treat the cached data as outdated
	* }
	* ```
	*/
	isStale() {
		if (this.getObserversCount() > 0) return this.observers.some((observer) => observer.getCurrentResult().isStale);
		return this.state.data === void 0 || this.state.isInvalidated;
	}
	/**
	* Returns `true` if the query's data is stale relative to the given
	* `staleTime` (defaults to `0`).
	* - A query with no data is always stale.
	* - `staleTime: 'static'` is never stale.
	* - An invalidated query is always stale.
	* - Otherwise, staleness is based on elapsed time since `dataUpdatedAt`.
	* @param staleTime - The time, in milliseconds, after which data is considered stale, or
	* `'static'` to never treat existing data as stale. A query without data is stale either way.
	* @returns `true` if the query's data is stale.
	* @see {@link Query#isStale}
	* @example
	* ```ts
	* const isStale = query.isStaleByTime(60 * 1000)
	* ```
	*/
	isStaleByTime(staleTime = 0) {
		if (this.state.data === void 0) return true;
		if (staleTime === "static") return false;
		if (this.state.isInvalidated) return true;
		return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
	}
	/**
	* Refetches the query when the window regains focus, if an observer wants that, and continues a
	* paused fetch.
	* @internal
	*/
	onFocus() {
		this.observers.find((x) => x.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: false });
		this.#retryer?.continue();
	}
	/**
	* Refetches the query when the app reconnects, if an observer wants that, and continues a paused
	* fetch.
	* @internal
	*/
	onOnline() {
		this.observers.find((x) => x.shouldFetchOnReconnect())?.refetch({ cancelRefetch: false });
		this.#retryer?.continue();
	}
	/**
	* Subscribes an observer to the query and stops its garbage collection.
	* @internal
	* @param observer - The observer to add. Adding an observer that is already subscribed does
	* nothing.
	*/
	addObserver(observer) {
		if (!this.observers.includes(observer)) {
			this.observers.push(observer);
			this.clearGcTimeout();
			this.#cache.notify({
				type: "observerAdded",
				query: this,
				observer
			});
		}
	}
	/**
	* Unsubscribes an observer from the query.
	* @internal
	* @param observer - The observer to remove. When the last observer is removed, the in-flight
	* fetch is cancelled if its abort signal was consumed (otherwise only its retries are stopped),
	* and garbage collection is scheduled.
	*/
	removeObserver(observer) {
		const index = this.observers.indexOf(observer);
		if (index !== -1) {
			this.observers.splice(index, 1);
			if (!this.observers.length) {
				if (this.#retryer) {
					if (this.#abortSignalConsumed || this.state.fetchStatus === "paused" && this.state.status === "pending") this.#retryer.cancel({ revert: true });
					else this.#retryer.cancelRetry();
				}
				this.scheduleGc();
			}
			this.#cache.notify({
				type: "observerRemoved",
				query: this,
				observer
			});
		}
	}
	/**
	* Returns the number of observers currently subscribed to this query.
	* @returns The number of observers.
	* @example
	* ```ts
	* if (query.getObserversCount() === 0) {
	*   // no component is currently watching this query
	* }
	* ```
	*/
	getObserversCount() {
		return this.observers.length;
	}
	/**
	* Marks the query as invalidated, unless it is already invalidated. This
	* updates `state.isInvalidated` and notifies observers, but does not by
	* itself trigger a refetch.
	* @example
	* ```ts
	* query.invalidate()
	* ```
	*/
	invalidate() {
		if (!this.state.isInvalidated) this.#dispatch({ type: "invalidate" });
	}
	/**
	* Fetches the query, i.e. runs its `queryFn` (through any configured
	* retryer/behavior) and updates the query's state with the result.
	* - If a fetch is already in flight, returns its promise instead of
	*   starting a new one, unless `fetchOptions.cancelRefetch` is set and the
	*   query already has data, in which case the current fetch is silently
	*   cancelled first.
	* - If `options` is passed, it replaces the query's current options
	*   before fetching.
	* @param options - Query options that replace the query's current options before fetching. They
	* are not applied when an in-flight fetch is reused.
	* @param fetchOptions - Set `cancelRefetch` to cancel an in-flight fetch first (only if the query
	* already has data), and `meta` to pass extra information to the query's behavior.
	* @returns A promise that resolves with the fetched data, or rejects with the fetch error. If the
	* fetch is cancelled with `revert` while the query has data, it resolves with the restored data
	* instead.
	*/
	async fetch(options, fetchOptions) {
		if (this.state.fetchStatus !== "idle" && this.#retryer?.status() !== "rejected") {
			if (this.state.data !== void 0 && fetchOptions?.cancelRefetch) this.cancel({ silent: true });
			else if (this.#retryer) {
				this.#retryer.continueRetry();
				return this.#retryer.promise;
			}
		}
		if (options) this.setOptions(options);
		if (!this.options.queryFn) {
			const observer = this.observers.find((x) => x.options.queryFn);
			if (observer) this.setOptions(observer.options);
		}
		if (process.env.NODE_ENV !== "production") {
			if (!Array.isArray(this.options.queryKey)) console.error(`As of v4, queryKey needs to be an Array. If you are using a string like 'repoData', please change it to an Array, e.g. ['repoData']`);
		}
		const abortController = new AbortController();
		const addSignalProperty = (object) => {
			Object.defineProperty(object, "signal", {
				enumerable: true,
				get: () => {
					this.#abortSignalConsumed = true;
					return abortController.signal;
				}
			});
		};
		const fetchFn = () => {
			const queryFn = ensureQueryFn(this.options, fetchOptions);
			const createQueryFnContext = () => {
				const queryFnContext = {
					client: this.#client,
					queryKey: this.queryKey,
					meta: this.meta
				};
				addSignalProperty(queryFnContext);
				return queryFnContext;
			};
			const queryFnContext = createQueryFnContext();
			this.#abortSignalConsumed = false;
			if (this.options.persister) return this.options.persister(queryFn, queryFnContext, this);
			return queryFn(queryFnContext);
		};
		const createFetchContext = () => {
			const context = {
				fetchOptions,
				options: this.options,
				queryKey: this.queryKey,
				client: this.#client,
				state: this.state,
				fetchFn
			};
			addSignalProperty(context);
			return context;
		};
		const context = createFetchContext();
		(this.#queryType === "infinite" ? infiniteQueryBehavior(this.options.pages) : this.options.behavior)?.onFetch(context, this);
		this.#revertState = this.state;
		if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta) this.#dispatch({
			type: "fetch",
			meta: context.fetchOptions?.meta
		});
		const retryer = this.#retryer = createRetryer({
			initialPromise: fetchOptions?.initialPromise,
			fn: context.fetchFn,
			onCancel: (error) => {
				if (error instanceof CancelledError && error.revert) this.setState({
					...this.#revertState,
					fetchStatus: "idle"
				});
				abortController.abort();
			},
			onFail: (failureCount, error) => {
				this.#dispatch({
					type: "failed",
					failureCount,
					error
				});
			},
			onPause: () => {
				this.#dispatch({ type: "pause" });
			},
			onContinue: () => {
				this.#dispatch({ type: "continue" });
			},
			retry: context.options.retry,
			retryDelay: context.options.retryDelay,
			networkMode: context.options.networkMode,
			canRun: () => true
		});
		try {
			const data = await retryer.start();
			if (data === void 0) {
				if (process.env.NODE_ENV !== "production") console.error(`Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ${this.queryHash}`);
				throw new Error(`${this.queryHash} data is undefined`);
			}
			this.setData(data);
			this.#cache.config.onSuccess?.(data, this);
			this.#cache.config.onSettled?.(data, this.state.error, this);
			return data;
		} catch (error) {
			if (error instanceof CancelledError) {
				if (error.silent) return this.#retryer.promise;
				else if (error.revert) {
					if (this.state.data === void 0) throw error;
					return this.state.data;
				}
			}
			this.#dispatch({
				type: "error",
				error
			});
			this.#cache.config.onError?.(error, this);
			this.#cache.config.onSettled?.(this.state.data, error, this);
			throw error;
		} finally {
			if (this.#retryer === retryer) this.#retryer = void 0;
			this.scheduleGc();
		}
	}
	#dispatch(action) {
		const reducer = (state) => {
			switch (action.type) {
				case "failed": return {
					...state,
					fetchFailureCount: action.failureCount,
					fetchFailureReason: action.error
				};
				case "pause": return {
					...state,
					fetchStatus: "paused"
				};
				case "continue": return {
					...state,
					fetchStatus: "fetching"
				};
				case "fetch": return {
					...state,
					...fetchState(state.data, this.options),
					fetchMeta: action.meta ?? null
				};
				case "success":
					const newState = {
						...state,
						...successState(action.data, action.dataUpdatedAt),
						dataUpdateCount: state.dataUpdateCount + 1,
						...!action.manual && {
							fetchStatus: "idle",
							fetchFailureCount: 0,
							fetchFailureReason: null
						}
					};
					this.#revertState = action.manual ? newState : void 0;
					return newState;
				case "error":
					const error = action.error;
					return {
						...state,
						error,
						errorUpdateCount: state.errorUpdateCount + 1,
						errorUpdatedAt: Date.now(),
						fetchFailureCount: state.fetchFailureCount + 1,
						fetchFailureReason: error,
						fetchStatus: "idle",
						status: "error",
						isInvalidated: true
					};
				case "invalidate": return {
					...state,
					isInvalidated: true
				};
				case "setState": return {
					...state,
					...action.state
				};
			}
		};
		this.state = reducer(this.state);
		notifyManager.batch(() => {
			this.observers.slice().forEach((observer) => {
				observer.onQueryUpdate();
			});
			this.#cache.notify({
				query: this,
				type: "updated",
				action
			});
		});
	}
};
/**
* Returns the state changes applied when a query starts fetching.
* @param data - The query's current data. If it is `undefined`, the query is also reset to
* `'pending'` with no error.
* @param options - The query options, whose `networkMode` decides whether the query is `'fetching'`
* or `'paused'`.
* @returns The partial query state for a starting fetch.
*/
function fetchState(data, options) {
	return {
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
		...data === void 0 && {
			error: null,
			status: "pending"
		}
	};
}
/**
* Returns the state changes applied when a query receives data.
* @param data - The new data.
* @param dataUpdatedAt - The timestamp the data is recorded with. Defaults to the current time.
* @returns The partial query state for a successful update.
*/
function successState(data, dataUpdatedAt) {
	return {
		data,
		dataUpdatedAt: dataUpdatedAt ?? Date.now(),
		error: null,
		isInvalidated: false,
		status: "success"
	};
}
/**
* Returns the initial state of a query, based on its `initialData` and `initialDataUpdatedAt`
* options.
* @param options - The query options.
* @returns The initial query state: `'success'` if `initialData` is set, otherwise `'pending'`.
*/
function getDefaultState(options) {
	const data = typeof options.initialData === "function" ? options.initialData() : options.initialData;
	const hasData = data !== void 0;
	const initialDataUpdatedAt = hasData ? typeof options.initialDataUpdatedAt === "function" ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt : 0;
	return {
		data,
		dataUpdateCount: 0,
		dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
		error: null,
		errorUpdateCount: 0,
		errorUpdatedAt: 0,
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchMeta: null,
		isInvalidated: false,
		status: hasData ? "success" : "pending",
		fetchStatus: "idle"
	};
}
export { resolveQueryValue as _, notifyManager as a, timeUntilStale as b, functionalUpdate as c, isValidTimeout as d, matchMutation as f, replaceData as g, partialMatchKey as h, createRetryer as i, hashKey as l, noop as m, fetchState as n, focusManager as o, matchQuery as p, Removable as r, isServer as s, Query as t, hashQueryKeyByOptions as u, shallowEqualObjects as v, timeoutManager as x, skipToken as y };

//# sourceMappingURL=query.js.map