import { i as Redirect, r as HttpError, t as ActionFailure } from "./shared.js";
import { G as request_store_after_await, Z as url_search_unavailable_prerender } from "./server-errors.js";
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/messages/internal/shared.js
/**
* Whether shared errors include their full text on the server even though `DEV` is false. This is
* enabled while the app is being built (analysed or prerendered)
*/
var verbose = false;
function enable_verbose_errors() {
	verbose = true;
}
/**
* @typedef {{ element?: Element }} ClientWarningOptions
* - `element`: logged after the warning, so that it can be inspected in the browser's devtools
*/
/** `console.warn` styles for the code and text of shared runtime warnings, as in Svelte */
var bold = "font-weight: bold";
var normal = "font-weight: normal";
/**
* Throws the full diagnostic. Generated helpers throw their URL-only production error inline, so
* bundlers can remove both this call and the message text from production browser builds
* @param {string} code
* @param {string} message
* @param {Function} caller The generated helper, which is omitted from the stack along with this function
* @returns {never}
*/
function throw_error(code, message, caller) {
	const error = /* @__PURE__ */ new Error(`${code}\n${message}\nhttps://svelte.dev/e/kit/${code}`);
	error.name = "SvelteKit error";
	Error.captureStackTrace?.(error, caller);
	throw error;
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/constants.js
/**
* A fake asset path used in `vite dev` and `vite preview`, so that we can
* serve local assets while verifying that requests are correctly prefixed
*/
var SVELTE_KIT_ASSETS = "/_svelte_kit_assets";
var ENDPOINT_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
	"HEAD",
	"QUERY"
];
var MUTATIVE_METHODS = [
	"POST",
	"PUT",
	"PATCH",
	"DELETE"
];
/** methods whose responses depend on the request body, so they can never be prerendered */
var BODY_DEPENDENT_METHODS = [...MUTATIVE_METHODS, "QUERY"];
var PAGE_METHODS = [
	"GET",
	"POST",
	"HEAD"
];
import.meta.dirname;
var IN_WEBCONTAINER = !!globalThis.process?.versions?.webcontainer;
/**
* If an an adapter deploys a catch-all serverless function, the rerouted URL
* is stored in this header.
*/
var REROUTED_URL_HEADER = "x-sveltekit-rerouted-url";
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/exports/internal/server/event.js
/** @import { RequestEvent } from '@sveltejs/kit' */
/** @import { RequestStore } from 'types' */
/** @import { AsyncLocalStorage } from 'node:async_hooks' */
/** @type {RequestStore | null} */
var sync_store = null;
/** @type {AsyncLocalStorage<RequestStore | null> | null} */
var als;
import("node:async_hooks").then((hooks) => als = new hooks.AsyncLocalStorage()).catch(() => {});
function get_request_store() {
	const result = try_get_request_store();
	if (!result) {
		if (als) throw new Error("Could not get the request store. This is an internal error.");
		request_store_after_await();
	}
	return result;
}
function try_get_request_store() {
	return sync_store ?? als?.getStore() ?? null;
}
/**
* @template T
* @param {RequestStore | null} store
* @param {() => T} fn
*/
function with_request_store(store, fn) {
	try {
		sync_store = store;
		return als ? als.run(store, fn) : fn();
	} finally {
		if (!IN_WEBCONTAINER) sync_store = null;
	}
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/exports/internal/server/index.js
/** @import { Span } from '@opentelemetry/api' */
function get_origin() {
	const request = try_get_request_store()?.event.request;
	return request && new URL(request.url).origin;
}
/**
* @template {{ tracing: { enabled: boolean, root: Span, current: Span } }} T
* @param {T} event_like
* @param {Span} current
* @returns {T}
*/
function merge_tracing(event_like, current) {
	return {
		...event_like,
		tracing: {
			...event_like.tracing,
			current
		}
	};
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/messages/shared-errors.js
/**
* Invalid array key `%key%`
* @param {{ "key": string }} _values
* @returns {never}
*/
function form_field_array_conflict(_values) {
	if (verbose) throw_error("form_field_array_conflict", `Invalid array key \`${_values.key}\``, form_field_array_conflict);
	throw new Error("https://svelte.dev/e/kit/form_field_array_conflict");
}
/**
* Form cannot contain duplicated keys — `%name%` has %count% values
* @param {{ "name": string; "count": string }} _values
* @returns {never}
*/
function form_field_duplicate(_values) {
	if (verbose) throw_error("form_field_duplicate", `Form cannot contain duplicated keys — \`${_values.name}\` has ${_values.count} values`, form_field_duplicate);
	throw new Error("https://svelte.dev/e/kit/form_field_duplicate");
}
/**
* Invalid key `%key%`: This key is not allowed to prevent prototype pollution.
* @param {{ "key": string }} _values
* @returns {never}
*/
function form_field_forbidden_key(_values) {
	if (verbose) throw_error("form_field_forbidden_key", `Invalid key \`${_values.key}\`: This key is not allowed to prevent prototype pollution.`, form_field_forbidden_key);
	throw new Error("https://svelte.dev/e/kit/form_field_forbidden_key");
}
/**
* Invalid field name `%name%`: field names are written in JS object notation, so keys that would need quoting are not supported. See https://svelte.dev/docs/kit/remote-functions#form-Fields
* @param {{ "name": string }} _values
* @returns {never}
*/
function form_field_invalid_name(_values) {
	if (verbose) throw_error("form_field_invalid_name", `Invalid field name \`${_values.name}\`: field names are written in JS object notation, so keys that would need quoting are not supported. See https://svelte.dev/docs/kit/remote-functions#form-Fields`, form_field_invalid_name);
	throw new Error("https://svelte.dev/e/kit/form_field_invalid_name");
}
/**
* Form contained a field that wasn't created with `form.fields.as(...)`: `%name%`
* @param {{ "name": string }} _values
* @returns {never}
*/
function form_field_unbound(_values) {
	if (verbose) throw_error("form_field_unbound", `Form contained a field that wasn't created with \`form.fields.as(...)\`: \`${_values.name}\``, form_field_unbound);
	throw new Error("https://svelte.dev/e/kit/form_field_unbound");
}
/**
* %type% inputs must have a value
* @param {{ "type": string }} _values
* @returns {never}
*/
function form_input_missing_value(_values) {
	if (verbose) throw_error("form_input_missing_value", `${_values.type} inputs must have a value`, form_input_missing_value);
	throw new Error("https://svelte.dev/e/kit/form_input_missing_value");
}
/**
* HTTP error status codes must be between 400 and 599 — %status% is invalid
* @param {{ "status": string }} _values
* @returns {never}
*/
function invalid_error_status(_values) {
	if (verbose) throw_error("invalid_error_status", `HTTP error status codes must be between 400 and 599 — ${_values.status} is invalid`, invalid_error_status);
	throw new Error("https://svelte.dev/e/kit/invalid_error_status");
}
/**
* Invalid export `%key%` (valid exports are %exports%, or anything with a `'_'` prefix)
* @param {{ "key": string; "exports": string; "file"?: string }} _values
* @returns {never}
*/
function invalid_export(_values) {
	if (verbose) throw_error("invalid_export", _values?.file !== void 0 ? `Invalid export \`${_values.key}\` in \`${_values.file}\` (valid exports are ${_values.exports}, or anything with a \`'_'\` prefix)` : `Invalid export \`${_values.key}\` (valid exports are ${_values.exports}, or anything with a \`'_'\` prefix)`, invalid_export);
	throw new Error("https://svelte.dev/e/kit/invalid_export");
}
/**
* Invalid export `%key%` (`%key%` is a valid export in %locations%)
* @param {{ "key": string; "locations": string; "file"?: string }} _values
* @returns {never}
*/
function invalid_export_location(_values) {
	if (verbose) throw_error("invalid_export_location", _values?.file !== void 0 ? `Invalid export \`${_values.key}\` in \`${_values.file}\` (\`${_values.key}\` is a valid export in ${_values.locations})` : `Invalid export \`${_values.key}\` (\`${_values.key}\` is a valid export in ${_values.locations})`, invalid_export_location);
	throw new Error("https://svelte.dev/e/kit/invalid_export_location");
}
/**
* Redirect status codes must be between 300 and 308 — %status% is invalid
* @param {{ "status": string }} _values
* @returns {never}
*/
function invalid_redirect_status(_values) {
	if (verbose) throw_error("invalid_redirect_status", `Redirect status codes must be between 300 and 308 — ${_values.status} is invalid`, invalid_redirect_status);
	throw new Error("https://svelte.dev/e/kit/invalid_redirect_status");
}
/**
* a `load` function %location% returned %type%, but must return a plain object at the top level (i.e. `return {...}`)
* @param {{ "location": string; "type": string }} _values
* @returns {never}
*/
function load_invalid_response(_values) {
	if (verbose) throw_error("load_invalid_response", `a \`load\` function ${_values.location} returned ${_values.type}, but must return a plain object at the top level (i.e. \`return {...}\`)`, load_invalid_response);
	throw new Error("https://svelte.dev/e/kit/load_invalid_response");
}
/**
* Async param matchers are not supported
* @param {void} _values
* @returns {never}
*/
function param_matcher_async(_values) {
	if (verbose) throw_error("param_matcher_async", `Async param matchers are not supported`, param_matcher_async);
	throw new Error("https://svelte.dev/e/kit/param_matcher_async");
}
/**
* Param matcher must return a string, number, boolean, or bigint
* @param {void} _values
* @returns {never}
*/
function param_matcher_result_invalid(_values) {
	if (verbose) throw_error("param_matcher_result_invalid", `Param matcher must return a string, number, boolean, or bigint`, param_matcher_result_invalid);
	throw new Error("https://svelte.dev/e/kit/param_matcher_result_invalid");
}
/**
* Cannot redirect to `%location%` with `{ external: true }`. The `javascript:` and `data:` protocols must be explicitly listed in the `external` allowlist
* @param {{ "location": string }} _values
* @returns {never}
*/
function redirect_external_javascript(_values) {
	if (verbose) throw_error("redirect_external_javascript", `Cannot redirect to \`${_values.location}\` with \`{ external: true }\`. The \`javascript:\` and \`data:\` protocols must be explicitly listed in the \`external\` allowlist`, redirect_external_javascript);
	throw new Error("https://svelte.dev/e/kit/redirect_external_javascript");
}
/**
* Cannot redirect to external URL `%location%`. To redirect to an external URL, pass `{ external: true }` or an allowlist of permitted origins as the third argument to `redirect`
* @param {{ "location": string }} _values
* @returns {never}
*/
function redirect_external_not_allowed(_values) {
	if (verbose) throw_error("redirect_external_not_allowed", `Cannot redirect to external URL \`${_values.location}\`. To redirect to an external URL, pass \`{ external: true }\` or an allowlist of permitted origins as the third argument to \`redirect\``, redirect_external_not_allowed);
	throw new Error("https://svelte.dev/e/kit/redirect_external_not_allowed");
}
/**
* Cannot redirect to `%location%`: URL origin is not included in the `external` allowlist
* @param {{ "location": string }} _values
* @returns {never}
*/
function redirect_external_not_in_allowlist(_values) {
	if (verbose) throw_error("redirect_external_not_in_allowlist", `Cannot redirect to \`${_values.location}\`: URL origin is not included in the \`external\` allowlist`, redirect_external_not_in_allowlist);
	throw new Error("https://svelte.dev/e/kit/redirect_external_not_in_allowlist");
}
/**
* `redirect` `options.external` must be `true` or an array of allowed origins
* @param {void} _values
* @returns {never}
*/
function redirect_external_option_invalid(_values) {
	if (verbose) throw_error("redirect_external_option_invalid", `\`redirect\` \`options.external\` must be \`true\` or an array of allowed origins`, redirect_external_option_invalid);
	throw new Error("https://svelte.dev/e/kit/redirect_external_option_invalid");
}
/**
* %type% are not valid remote function arguments
* @param {{ "type": string }} _values
* @returns {never}
*/
function remote_argument_unsupported(_values) {
	if (verbose) throw_error("remote_argument_unsupported", `${_values.type} are not valid remote function arguments`, remote_argument_unsupported);
	throw new Error("https://svelte.dev/e/kit/remote_argument_unsupported");
}
/**
* Missing params for dynamic route ID `%id%`
* @param {{ "id": string }} _values
* @returns {never}
*/
function resolve_params_missing(_values) {
	if (verbose) throw_error("resolve_params_missing", `Missing params for dynamic route ID \`${_values.id}\``, resolve_params_missing);
	throw new Error("https://svelte.dev/e/kit/resolve_params_missing");
}
/**
* Missing parameter `%name%` in route `%id%`
* @param {{ "name": string; "id": string }} _values
* @returns {never}
*/
function route_param_missing(_values) {
	if (verbose) throw_error("route_param_missing", `Missing parameter \`${_values.name}\` in route \`${_values.id}\``, route_param_missing);
	throw new Error("https://svelte.dev/e/kit/route_param_missing");
}
/**
* Parameter `%name%` in route `%id%` cannot start or end with a slash — this would cause an invalid route like `foo/bar`
* @param {{ "name": string; "id": string }} _values
* @returns {never}
*/
function route_param_slash(_values) {
	if (verbose) throw_error("route_param_slash", `Parameter \`${_values.name}\` in route \`${_values.id}\` cannot start or end with a slash — this would cause an invalid route like \`foo/bar\``, route_param_slash);
	throw new Error("https://svelte.dev/e/kit/route_param_slash");
}
/**
* Parameter `%name%` in route `%id%` must be a string, number, boolean, or bigint
* @param {{ "name": string; "id": string }} _values
* @returns {never}
*/
function route_param_value_invalid(_values) {
	if (verbose) throw_error("route_param_value_invalid", `Parameter \`${_values.name}\` in route \`${_values.id}\` must be a string, number, boolean, or bigint`, route_param_value_invalid);
	throw new Error("https://svelte.dev/e/kit/route_param_value_invalid");
}
/**
* Cannot access `event.url.hash`. Consider using `page.url.hash` inside a component instead
* @param {void} _values
* @returns {never}
*/
function url_hash_unavailable(_values) {
	if (verbose) throw_error("url_hash_unavailable", `Cannot access \`event.url.hash\`. Consider using \`page.url.hash\` inside a component instead`, url_hash_unavailable);
	throw new Error("https://svelte.dev/e/kit/url_hash_unavailable");
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/utils/url.js
/**
* Matches a URI scheme. See https://www.rfc-editor.org/rfc/rfc3986#section-3.1
* @type {RegExp}
*/
var SCHEME = /^[a-z][a-z\d+\-.]*:/i;
var internal = new URL("a://");
/**
* @param {string} base
* @param {string} path
*/
function resolve(base, path) {
	if (path[0] === "/" && path[1] === "/") return path;
	let url = new URL(base, internal);
	url = new URL(path, url);
	return url.protocol === internal.protocol ? url.pathname + url.search + url.hash : url.href;
}
/**
* Relative reference from `from` to `to`, which must differ only by a trailing slash
* @param {string} from
* @param {string} to
* @returns {string}
*/
function relative_pathname(from, to) {
	const segment = to.replace(/\/$/, "").split("/").at(-1);
	return from.endsWith("/") ? `../${segment}` : `./${segment}/`;
}
/**
* @param {string} location
* @param {string} allowed
*/
function matches_external_allowlist_entry(location, allowed) {
	if (location === allowed) return true;
	try {
		const allow = new URL(allowed);
		const loc = new URL(location, allow);
		return loc.protocol === allow.protocol && loc.host === allow.host;
	} catch {
		return false;
	}
}
/**
* @param {string} path
* @param {import('types').TrailingSlash} trailing_slash
*/
function normalize_path(path, trailing_slash) {
	if (path === "/" || trailing_slash === "ignore") return path;
	if (trailing_slash === "never") return path.endsWith("/") ? path.slice(0, -1) : path;
	else if (trailing_slash === "always" && !path.endsWith("/")) return path + "/";
	return path;
}
/**
* Decode pathname excluding %25 to prevent further double decoding of params
* @param {string} pathname
*/
function decode_pathname(pathname) {
	return pathname.split("%25").map(decodeURI).join("%25");
}
/**
* @param {URL} url
* @param {() => void} callback
* @param {(search_param: string) => void} search_params_callback
* @param {boolean} [allow_hash]
*/
function make_trackable(url, callback, search_params_callback, allow_hash = false) {
	const tracked = new URL(url);
	Object.defineProperty(tracked, "searchParams", {
		value: new Proxy(tracked.searchParams, { get(obj, key) {
			if (key === "get" || key === "getAll" || key === "has") return (param, ...rest) => {
				search_params_callback(param);
				return obj[key](param, ...rest);
			};
			callback();
			const value = Reflect.get(obj, key);
			return typeof value === "function" ? value.bind(obj) : value;
		} }),
		enumerable: true,
		configurable: true
	});
	/**
	* URL properties that could change during the lifetime of the page,
	* which excludes things like `origin`
	* @type {(keyof URL)[]}
	*/
	const tracked_url_properties = [
		"href",
		"pathname",
		"search",
		"toString",
		"toJSON"
	];
	if (allow_hash) tracked_url_properties.push("hash");
	for (const property of tracked_url_properties) Object.defineProperty(tracked, property, {
		get() {
			callback();
			return url[property];
		},
		enumerable: true,
		configurable: true
	});
	tracked[Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
		return inspect(url, opts);
	};
	tracked.searchParams[Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
		return inspect(url.searchParams, opts);
	};
	if (!allow_hash) disable_hash(tracked);
	return tracked;
}
/**
* Disallow access to `url.hash` on the server and in `load`
* @param {URL} url
*/
function disable_hash(url) {
	allow_nodejs_console_log(url);
	Object.defineProperty(url, "hash", { get() {
		return url_hash_unavailable();
	} });
}
/**
* Disallow access to `url.search` and `url.searchParams` during prerendering
* @param {URL} url
*/
function disable_search(url) {
	allow_nodejs_console_log(url);
	for (const property of ["search", "searchParams"]) Object.defineProperty(url, property, { get() {
		return url_search_unavailable_prerender({ property });
	} });
}
/**
* Allow URL to be console logged, bypassing disabled properties.
* @param {URL} url
*/
function allow_nodejs_console_log(url) {
	url[Symbol.for("nodejs.util.inspect.custom")] = (_depth, opts, inspect) => {
		return inspect(new URL(url), opts);
	};
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/exports/url.js
var REDIRECT_BASE = "https://sveltekit-redirect.invalid";
/**
* Whether a redirect location is absolute, i.e. not a root-relative or path-relative URL,
* and not pointing to the same origin as we're currently on (if determineable).
* @param {string} location
*/
function is_external_location(location) {
	const origin = get_origin();
	try {
		return !matches_external_allowlist_entry(location, origin ?? REDIRECT_BASE);
	} catch {
		return true;
	}
}
var javascript_protocols = /* @__PURE__ */ new Set(["javascript:", "data:"]);
/**
* @param {string} location
*/
function is_javascript_location(location) {
	try {
		return javascript_protocols.has(new URL(location, REDIRECT_BASE).protocol);
	} catch {
		return false;
	}
}
/**
* @param {string} location
* @param {{ external?: boolean | string[] }} [options]
*/
function validate_redirect_location(location, options) {
	if (!is_external_location(location)) return;
	const external = options?.external;
	if (!external) redirect_external_not_allowed({ location: JSON.stringify(location) });
	if (external === true) {
		if (is_javascript_location(location)) redirect_external_javascript({ location: JSON.stringify(location) });
		return;
	}
	if (Array.isArray(external)) {
		if (!external.some((allowed) => matches_external_allowlist_entry(location, allowed))) redirect_external_not_in_allowlist({ location: JSON.stringify(location) });
		return;
	}
	redirect_external_option_invalid();
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/messages/shared-warnings.js
/**
* `%route%`: Calling `depends('%dependency%')` will throw an error in Firefox because `%scheme%` is a special URI scheme
* @param {{ "route": string; "dependency": string; "scheme": string }} _values
*/
function depends_special_scheme(_values) {
	console.warn("https://svelte.dev/e/kit/depends_special_scheme");
}
/**
* The properties of `form.fields` are virtual, so operators like `in` and `Object.keys` are meaningless. If you need the current value of a form field, use `form.fields.x.value()`
* @param {void} _values
*/
function form_fields_enumerated(_values) {
	console.warn("https://svelte.dev/e/kit/form_fields_enumerated");
}
// ../implement-spec-383/node_modules/.pnpm/@sveltejs+kit@3.1.1_@sveltejs+vite-plugin-svelte@7.3.1_svelte@5.57.3_@typescript-eslint_8cf52fe09df2de537dd906a98b5e1516/node_modules/@sveltejs/kit/src/exports/index.js
/** @import { StandardSchemaV1 } from '@standard-schema/spec' */
var text_encoder = new TextEncoder();
/**
* Throws an error with a HTTP status code and an optional message.
* When called during request handling, this will cause SvelteKit to
* return an error response; the error will be passed to `handleError` as an _expected_ error.
* Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
* @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @param {string} [message] The error message.
* @overload
* @param {{ status: number; message: string } extends App.Error ? number : never} status
* @param {{ status: number; message: string } extends App.Error ? string : never} [message]
* @return {never}
* @throws {import('./public.js').HttpError} This error instructs SvelteKit to initiate HTTP error handling.
* @throws {Error} If the provided status is invalid (not between 400 and 599).
*/
/**
* Throws an error with a HTTP status code and an optional message.
* When called during request handling, this will cause SvelteKit to
* return an error response; the error will be passed to `handleError` as an _expected_ error.
* Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
* @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @param {string} message The error message.
* @param {keyof Omit<App.Error, 'status' | 'message'> extends never ? never : Omit<App.Error, 'status' | 'message'>} properties Additional properties of the App.Error type.
* @overload
* @param {number} status
* @param {string} message
* @param {keyof Omit<App.Error, 'status' | 'message'> extends never ? never : Omit<App.Error, 'status' | 'message'>} properties
* @return {never}
* @throws {import('./public.js').HttpError} This error instructs SvelteKit to initiate HTTP error handling.
* @throws {Error} If the provided status is invalid (not between 400 and 599).
*/
/**
* Throws an error with a HTTP status code and an optional message.
* When called during request handling, this will cause SvelteKit to
* return an error response; the error will be passed to `handleError` as an _expected_ error.
* Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
* @deprecated Passing an `App.Error` body as the second argument is deprecated — pass the `message` as the second argument, and any additional properties as the third
* @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @param {Omit<App.Error, 'status'> & { status?: App.Error['status'] }} body An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
* @overload
* @param {number} status
* @param {Omit<App.Error, 'status'> & { status?: App.Error['status'] }} properties
* @return {never}
* @throws {import('./public.js').HttpError} This error instructs SvelteKit to initiate HTTP error handling.
* @throws {Error} If the provided status is invalid (not between 400 and 599).
*/
/**
* Throws an error with a HTTP status code and an optional message.
* When called during request handling, this will cause SvelteKit to
* return an error response; the error will be passed to `handleError` as an _expected_ error.
* Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
* @param {any} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @param {any} [message] A string, or (deprecated) a partial App.Error object
* @param {any} [properties] Additional properties of the App.Error type when passing a string message.
* @return {never}
* @throws {import('./public.js').HttpError} This error instructs SvelteKit to initiate HTTP error handling.
* @throws {Error} If the provided status is invalid (not between 400 and 599).
*/
function error(status, message, properties) {
	if (isNaN(status) || status < 400 || status > 599) invalid_error_status({ status: String(status) });
	if (message !== void 0 && typeof message !== "string") ({message, ...properties} = message);
	throw new HttpError({
		...properties,
		status,
		message: message ?? `Error: ${status}`
	});
}
/**
* Redirect a request. When called during request handling, SvelteKit will return a redirect response.
* Make sure you're not catching the thrown redirect, which would prevent SvelteKit from handling it.
*
* Most common status codes:
*  * `303 See Other`: redirect as a GET request (often used after a form POST request)
*  * `307 Temporary Redirect`: redirect will keep the request method
*  * `308 Permanent Redirect`: redirect will keep the request method, SEO will be transferred to the new page
*
* [See all redirect status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages)
*
* @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | ({} & number)} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages). Must be in the range 300-308.
* @param {string | URL} location The location to redirect to.
* @param {{ external?: boolean | string[] }} [options] To redirect to an external URL, you must pass `{ external: true }` to allow any external URL except `javascript:` URLs, or `{ external: [...] }` with an allowlist of permitted origins.
* @throws {import('./public.js').Redirect} This error instructs SvelteKit to redirect to the specified location.
* @throws {Error} If the provided status is invalid, the location cannot be used as a header value, or the location is an external URL without permission.
* @return {never}
*/
function redirect(status, location, options) {
	if (isNaN(status) || status < 300 || status > 308) invalid_redirect_status({ status: String(status) });
	const href = location.toString();
	validate_redirect_location(href, options);
	throw new Redirect(status, href);
}
/**
* Checks whether this is a redirect thrown by {@link redirect}.
* @param {unknown} e The object to check.
* @return {e is import('./public.js').Redirect}
*/
function isRedirect(e) {
	return e instanceof Redirect;
}
/**
* Create a JSON `Response` object from the supplied data.
* @param {any} data The value that will be serialized as JSON.
* @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. `Content-Type: application/json` and `Content-Length` headers will be added automatically.
* @deprecated use `Response.json`
*/
function json(data, init) {
	const body = JSON.stringify(data);
	const headers = new Headers(init?.headers);
	if (!headers.has("content-length")) headers.set("content-length", text_encoder.encode(body).byteLength.toString());
	if (!headers.has("content-type")) headers.set("content-type", "application/json");
	return new Response(body, {
		...init,
		headers
	});
}
/**
* Create a `Response` object from the supplied body.
* @param {string} body The value that will be used as-is.
* @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. A `Content-Length` header will be added automatically.
* @deprecated use `new Response`
*/
function text(body, init) {
	const headers = new Headers(init?.headers);
	if (!headers.has("content-length")) {
		const encoded = text_encoder.encode(body);
		headers.set("content-length", encoded.byteLength.toString());
		return new Response(encoded, {
			...init,
			headers
		});
	}
	return new Response(body, {
		...init,
		headers
	});
}
/**
* Create an `ActionFailure` object. Call when form submission fails.
* @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @overload
* @param {number} status
* @returns {import('./public.js').ActionFailure<undefined>}
*/
/**
* Create an `ActionFailure` object. Call when form submission fails.
* @template [T=undefined]
* @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
* @param {T} data Data associated with the failure (e.g. validation errors)
* @overload
* @param {number} status
* @param {T} data
* @returns {import('./public.js').ActionFailure<T>}
*/
/**
* Create an `ActionFailure` object. Call when form submission fails.
* @param {number} status
* @param {any} [data]
* @returns {import('./public.js').ActionFailure<any>}
*/
function fail(status, data) {
	return new ActionFailure(status, data);
}
export { route_param_slash as A, PAGE_METHODS as B, invalid_export_location as C, remote_argument_unsupported as D, param_matcher_result_invalid as E, with_request_store as F, normal as G, SVELTE_KIT_ASSETS as H, BODY_DEPENDENT_METHODS as I, ENDPOINT_METHODS as L, merge_tracing as M, get_request_store as N, resolve_params_missing as O, try_get_request_store as P, IN_WEBCONTAINER as R, invalid_export as S, param_matcher_async as T, bold as U, REROUTED_URL_HEADER as V, enable_verbose_errors as W, form_field_duplicate as _, redirect as a, form_field_unbound as b, form_fields_enumerated as c, disable_search as d, make_trackable as f, form_field_array_conflict as g, resolve as h, json as i, route_param_value_invalid as j, route_param_missing as k, SCHEME as l, relative_pathname as m, fail as n, text as o, normalize_path as p, isRedirect as r, depends_special_scheme as s, error as t, decode_pathname as u, form_field_forbidden_key as v, load_invalid_response as w, form_input_missing_value as x, form_field_invalid_name as y, MUTATIVE_METHODS as z };

//# sourceMappingURL=exports.js.map