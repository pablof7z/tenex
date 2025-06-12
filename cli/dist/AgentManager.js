import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
	target = mod != null ? __create(__getProtoOf(mod)) : {};
	const to =
		isNodeMode || !mod || !mod.__esModule
			? __defProp(target, "default", { value: mod, enumerable: true })
			: target;
	for (const key of __getOwnPropNames(mod))
		if (!__hasOwnProp.call(to, key))
			__defProp(to, key, {
				get: () => mod[key],
				enumerable: true,
			});
	return to;
};
var __commonJS = (cb, mod) => () => (
	mod || cb((mod = { exports: {} }).exports, mod), mod.exports
);
var __export = (target, all) => {
	for (var name in all)
		__defProp(target, name, {
			get: all[name],
			enumerable: true,
			configurable: true,
			set: (newValue) => (all[name] = () => newValue),
		});
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/tseep/lib/types.js
var require_types = __commonJS((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
});

// node_modules/tseep/lib/task-collection/utils.js
var require_utils = __commonJS((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports._fast_remove_single = undefined;
	function _fast_remove_single(arr, index) {
		if (index === -1) return;
		if (index === 0) arr.shift();
		else if (index === arr.length - 1) arr.length = arr.length - 1;
		else arr.splice(index, 1);
	}
	exports._fast_remove_single = _fast_remove_single;
});

// node_modules/tseep/lib/task-collection/bake-collection.js
var require_bake_collection = __commonJS((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.bakeCollectionVariadic =
		exports.bakeCollectionAwait =
		exports.bakeCollection =
		exports.BAKED_EMPTY_FUNC =
			undefined;
	exports.BAKED_EMPTY_FUNC = () => {};
	var FORLOOP_FALLBACK = 1500;
	function generateArgsDefCode(numArgs) {
		var argsDefCode2 = "";
		if (numArgs === 0) return argsDefCode2;
		for (var i = 0; i < numArgs - 1; ++i) {
			argsDefCode2 += "arg" + String(i) + ", ";
		}
		argsDefCode2 += "arg" + String(numArgs - 1);
		return argsDefCode2;
	}
	function generateBodyPartsCode(argsDefCode2, collectionLength) {
		var funcDefCode2 = "",
			funcCallCode2 = "";
		for (var i = 0; i < collectionLength; ++i) {
			funcDefCode2 += "var f".concat(i, " = collection[").concat(
				i,
				`];
`,
			);
			funcCallCode2 += "f".concat(i, "(").concat(
				argsDefCode2,
				`)
`,
			);
		}
		return { funcDefCode: funcDefCode2, funcCallCode: funcCallCode2 };
	}
	function generateBodyPartsVariadicCode(collectionLength) {
		var funcDefCode2 = "",
			funcCallCode2 = "";
		for (var i = 0; i < collectionLength; ++i) {
			funcDefCode2 += "var f".concat(i, " = collection[").concat(
				i,
				`];
`,
			);
			funcCallCode2 += "f".concat(
				i,
				`.apply(undefined, arguments)
`,
			);
		}
		return { funcDefCode: funcDefCode2, funcCallCode: funcCallCode2 };
	}
	function bakeCollection(collection, fixedArgsNum) {
		if (collection.length === 0) return exports.BAKED_EMPTY_FUNC;
		else if (collection.length === 1) return collection[0];
		var funcFactoryCode;
		if (collection.length < FORLOOP_FALLBACK) {
			var argsDefCode = generateArgsDefCode(fixedArgsNum);
			var _a = generateBodyPartsCode(argsDefCode, collection.length),
				funcDefCode = _a.funcDefCode,
				funcCallCode = _a.funcCallCode;
			funcFactoryCode = `(function(collection) {
            `
				.concat(
					funcDefCode,
					`
            collection = undefined;
            return (function(`,
				)
				.concat(
					argsDefCode,
					`) {
                `,
				)
				.concat(
					funcCallCode,
					`
            });
        })`,
				);
		} else {
			var argsDefCode = generateArgsDefCode(fixedArgsNum);
			if (collection.length % 10 === 0) {
				funcFactoryCode = `(function(collection) {
                return (function(`
					.concat(
						argsDefCode,
						`) {
                    for (var i = 0; i < collection.length; i += 10) {
                        collection[i](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+1](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+2](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+3](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+4](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+5](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+6](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+7](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+8](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+9](`,
					)
					.concat(
						argsDefCode,
						`);
                    }
                });
            })`,
					);
			} else if (collection.length % 4 === 0) {
				funcFactoryCode = `(function(collection) {
                return (function(`
					.concat(
						argsDefCode,
						`) {
                    for (var i = 0; i < collection.length; i += 4) {
                        collection[i](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+1](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+2](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+3](`,
					)
					.concat(
						argsDefCode,
						`);
                    }
                });
            })`,
					);
			} else if (collection.length % 3 === 0) {
				funcFactoryCode = `(function(collection) {
                return (function(`
					.concat(
						argsDefCode,
						`) {
                    for (var i = 0; i < collection.length; i += 3) {
                        collection[i](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+1](`,
					)
					.concat(
						argsDefCode,
						`);
                        collection[i+2](`,
					)
					.concat(
						argsDefCode,
						`);
                    }
                });
            })`,
					);
			} else {
				funcFactoryCode = `(function(collection) {
                return (function(`
					.concat(
						argsDefCode,
						`) {
                    for (var i = 0; i < collection.length; ++i) {
                        collection[i](`,
					)
					.concat(
						argsDefCode,
						`);
                    }
                });
            })`,
					);
			}
		}
		var bakeCollection_1 = undefined;
		var fixedArgsNum_1 = undefined;
		var bakeCollectionVariadic_1 = undefined;
		var bakeCollectionAwait_1 = undefined;
		var funcFactory = eval(funcFactoryCode);
		return funcFactory(collection);
	}
	exports.bakeCollection = bakeCollection;
	function bakeCollectionAwait(collection, fixedArgsNum) {
		if (collection.length === 0) return exports.BAKED_EMPTY_FUNC;
		else if (collection.length === 1) return collection[0];
		var funcFactoryCode;
		if (collection.length < FORLOOP_FALLBACK) {
			var argsDefCode = generateArgsDefCode(fixedArgsNum);
			var _a = generateBodyPartsCode(argsDefCode, collection.length),
				funcDefCode = _a.funcDefCode,
				funcCallCode = _a.funcCallCode;
			funcFactoryCode = `(function(collection) {
            `
				.concat(
					funcDefCode,
					`
            collection = undefined;
            return (function(`,
				)
				.concat(
					argsDefCode,
					`) {
                return Promise.all([ `,
				)
				.concat(
					funcCallCode,
					` ]);
            });
        })`,
				);
		} else {
			var argsDefCode = generateArgsDefCode(fixedArgsNum);
			funcFactoryCode = `(function(collection) {
            return (function(`
				.concat(
					argsDefCode,
					`) {
                var promises = Array(collection.length);
                for (var i = 0; i < collection.length; ++i) {
                    promises[i] = collection[i](`,
				)
				.concat(
					argsDefCode,
					`);
                }
                return Promise.all(promises);
            });
        })`,
				);
		}
		var bakeCollection_2 = undefined;
		var fixedArgsNum_2 = undefined;
		var bakeCollectionVariadic_2 = undefined;
		var bakeCollectionAwait_2 = undefined;
		var funcFactory = eval(funcFactoryCode);
		return funcFactory(collection);
	}
	exports.bakeCollectionAwait = bakeCollectionAwait;
	function bakeCollectionVariadic(collection) {
		if (collection.length === 0) return exports.BAKED_EMPTY_FUNC;
		else if (collection.length === 1) return collection[0];
		var funcFactoryCode;
		if (collection.length < FORLOOP_FALLBACK) {
			var _a = generateBodyPartsVariadicCode(collection.length),
				funcDefCode = _a.funcDefCode,
				funcCallCode = _a.funcCallCode;
			funcFactoryCode = `(function(collection) {
            `
				.concat(
					funcDefCode,
					`
            collection = undefined;
            return (function() {
                `,
				)
				.concat(
					funcCallCode,
					`
            });
        })`,
				);
		} else {
			funcFactoryCode = `(function(collection) {
            return (function() {
                for (var i = 0; i < collection.length; ++i) {
                    collection[i].apply(undefined, arguments);
                }
            });
        })`;
		}
		var bakeCollection_3 = undefined;
		var fixedArgsNum = undefined;
		var bakeCollectionVariadic_3 = undefined;
		var bakeCollectionAwait_3 = undefined;
		var funcFactory = eval(funcFactoryCode);
		return funcFactory(collection);
	}
	exports.bakeCollectionVariadic = bakeCollectionVariadic;
});

// node_modules/tseep/lib/task-collection/task-collection.js
var require_task_collection = __commonJS((exports) => {
	var __spreadArray =
		(exports && exports.__spreadArray) ||
		((to, from, pack) => {
			if (pack || arguments.length === 2)
				for (var i = 0, l = from.length, ar; i < l; i++) {
					if (ar || !(i in from)) {
						if (!ar) ar = Array.prototype.slice.call(from, 0, i);
						ar[i] = from[i];
					}
				}
			return to.concat(ar || Array.prototype.slice.call(from));
		});
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TaskCollection = undefined;
	var utils_1 = require_utils();
	var bake_collection_1 = require_bake_collection();
	function push_norebuild(a, b) {
		var len = this.length;
		if (len > 1) {
			if (b) {
				var _a2;
				(_a2 = this._tasks).push.apply(_a2, arguments);
				this.length += arguments.length;
			} else {
				this._tasks.push(a);
				this.length++;
			}
		} else {
			if (b) {
				if (len === 1) {
					var newAr = Array(1 + arguments.length);
					newAr.push(newAr);
					newAr.push.apply(newAr, arguments);
					this._tasks = newAr;
				} else {
					var newAr = Array(arguments.length);
					newAr.push.apply(newAr, arguments);
					this._tasks = newAr;
				}
				this.length += arguments.length;
			} else {
				if (len === 1) this._tasks = [this._tasks, a];
				else this._tasks = a;
				this.length++;
			}
		}
	}
	function push_rebuild(a, b) {
		var len = this.length;
		if (len > 1) {
			if (b) {
				var _a2;
				(_a2 = this._tasks).push.apply(_a2, arguments);
				this.length += arguments.length;
			} else {
				this._tasks.push(a);
				this.length++;
			}
		} else {
			if (b) {
				if (len === 1) {
					var newAr = Array(1 + arguments.length);
					newAr.push(newAr);
					newAr.push.apply(newAr, arguments);
					this._tasks = newAr;
				} else {
					var newAr = Array(arguments.length);
					newAr.push.apply(newAr, arguments);
					this._tasks = newAr;
				}
				this.length += arguments.length;
			} else {
				if (len === 1) this._tasks = [this._tasks, a];
				else this._tasks = a;
				this.length++;
			}
		}
		if (this.firstEmitBuildStrategy) this.call = rebuild_on_first_call;
		else this.rebuild();
	}
	function removeLast_norebuild(a) {
		if (this.length === 0) return;
		if (this.length === 1) {
			if (this._tasks === a) {
				this.length = 0;
			}
		} else {
			(0, utils_1._fast_remove_single)(this._tasks, this._tasks.lastIndexOf(a));
			if (this._tasks.length === 1) {
				this._tasks = this._tasks[0];
				this.length = 1;
			} else this.length = this._tasks.length;
		}
	}
	function removeLast_rebuild(a) {
		if (this.length === 0) return;
		if (this.length === 1) {
			if (this._tasks === a) {
				this.length = 0;
			}
			if (this.firstEmitBuildStrategy) {
				this.call = bake_collection_1.BAKED_EMPTY_FUNC;
				return;
			} else {
				this.rebuild();
				return;
			}
		} else {
			(0, utils_1._fast_remove_single)(this._tasks, this._tasks.lastIndexOf(a));
			if (this._tasks.length === 1) {
				this._tasks = this._tasks[0];
				this.length = 1;
			} else this.length = this._tasks.length;
		}
		if (this.firstEmitBuildStrategy) this.call = rebuild_on_first_call;
		else this.rebuild();
	}
	function insert_norebuild(index) {
		var _b;
		var func = [];
		for (var _i = 1; _i < arguments.length; _i++) {
			func[_i - 1] = arguments[_i];
		}
		if (this.length === 0) {
			this._tasks = func;
			this.length = 1;
		} else if (this.length === 1) {
			func.unshift(this._tasks);
			this._tasks = func;
			this.length = this._tasks.length;
		} else {
			(_b = this._tasks).splice.apply(
				_b,
				__spreadArray([index, 0], func, false),
			);
			this.length = this._tasks.length;
		}
	}
	function insert_rebuild(index) {
		var _b;
		var func = [];
		for (var _i = 1; _i < arguments.length; _i++) {
			func[_i - 1] = arguments[_i];
		}
		if (this.length === 0) {
			this._tasks = func;
			this.length = 1;
		} else if (this.length === 1) {
			func.unshift(this._tasks);
			this._tasks = func;
			this.length = this._tasks.length;
		} else {
			(_b = this._tasks).splice.apply(
				_b,
				__spreadArray([index, 0], func, false),
			);
			this.length = this._tasks.length;
		}
		if (this.firstEmitBuildStrategy) this.call = rebuild_on_first_call;
		else this.rebuild();
	}
	function rebuild_noawait() {
		if (this.length === 0) this.call = bake_collection_1.BAKED_EMPTY_FUNC;
		else if (this.length === 1) this.call = this._tasks;
		else
			this.call = (0, bake_collection_1.bakeCollection)(
				this._tasks,
				this.argsNum,
			);
	}
	function rebuild_await() {
		if (this.length === 0) this.call = bake_collection_1.BAKED_EMPTY_FUNC;
		else if (this.length === 1) this.call = this._tasks;
		else
			this.call = (0, bake_collection_1.bakeCollectionAwait)(
				this._tasks,
				this.argsNum,
			);
	}
	function rebuild_on_first_call() {
		this.rebuild();
		this.call.apply(undefined, arguments);
	}
	var TaskCollection = (() => {
		function TaskCollection2(argsNum, autoRebuild, initialTasks, awaitTasks) {
			if (autoRebuild === undefined) {
				autoRebuild = true;
			}
			if (initialTasks === undefined) {
				initialTasks = null;
			}
			if (awaitTasks === undefined) {
				awaitTasks = false;
			}
			this.awaitTasks = awaitTasks;
			this.call = bake_collection_1.BAKED_EMPTY_FUNC;
			this.argsNum = argsNum;
			this.firstEmitBuildStrategy = true;
			if (awaitTasks) this.rebuild = rebuild_await.bind(this);
			else this.rebuild = rebuild_noawait.bind(this);
			this.setAutoRebuild(autoRebuild);
			if (initialTasks) {
				if (typeof initialTasks === "function") {
					this._tasks = initialTasks;
					this.length = 1;
				} else {
					this._tasks = initialTasks;
					this.length = initialTasks.length;
				}
			} else {
				this._tasks = null;
				this.length = 0;
			}
			if (autoRebuild) this.rebuild();
		}
		return TaskCollection2;
	})();
	exports.TaskCollection = TaskCollection;
	function fastClear() {
		this._tasks = null;
		this.length = 0;
		this.call = bake_collection_1.BAKED_EMPTY_FUNC;
	}
	function clear() {
		this._tasks = null;
		this.length = 0;
		this.call = bake_collection_1.BAKED_EMPTY_FUNC;
	}
	function growArgsNum(argsNum) {
		if (this.argsNum < argsNum) {
			this.argsNum = argsNum;
			if (this.firstEmitBuildStrategy) this.call = rebuild_on_first_call;
			else this.rebuild();
		}
	}
	function setAutoRebuild(newVal) {
		if (newVal) {
			this.push = push_rebuild.bind(this);
			this.insert = insert_rebuild.bind(this);
			this.removeLast = removeLast_rebuild.bind(this);
		} else {
			this.push = push_norebuild.bind(this);
			this.insert = insert_norebuild.bind(this);
			this.removeLast = removeLast_norebuild.bind(this);
		}
	}
	function tasksAsArray() {
		if (this.length === 0) return [];
		if (this.length === 1) return [this._tasks];
		return this._tasks;
	}
	function setTasks(tasks) {
		if (tasks.length === 0) {
			this.length = 0;
			this.call = bake_collection_1.BAKED_EMPTY_FUNC;
		} else if (tasks.length === 1) {
			this.length = 1;
			this.call = tasks[0];
			this._tasks = tasks[0];
		} else {
			this.length = tasks.length;
			this._tasks = tasks;
			if (this.firstEmitBuildStrategy) this.call = rebuild_on_first_call;
			else this.rebuild();
		}
	}
	TaskCollection.prototype.fastClear = fastClear;
	TaskCollection.prototype.clear = clear;
	TaskCollection.prototype.growArgsNum = growArgsNum;
	TaskCollection.prototype.setAutoRebuild = setAutoRebuild;
	TaskCollection.prototype.tasksAsArray = tasksAsArray;
	TaskCollection.prototype.setTasks = setTasks;
});

// node_modules/tseep/lib/task-collection/index.js
var require_task_collection2 = __commonJS((exports) => {
	var __createBinding =
		(exports && exports.__createBinding) ||
		(Object.create
			? (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					var desc = Object.getOwnPropertyDescriptor(m, k);
					if (
						!desc ||
						("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
					) {
						desc = { enumerable: true, get: () => m[k] };
					}
					Object.defineProperty(o, k2, desc);
				}
			: (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					o[k2] = m[k];
				});
	var __exportStar =
		(exports && exports.__exportStar) ||
		((m, exports2) => {
			for (var p in m)
				if (
					p !== "default" &&
					!Object.prototype.hasOwnProperty.call(exports2, p)
				)
					__createBinding(exports2, m, p);
		});
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_task_collection(), exports);
});

// node_modules/tseep/lib/utils.js
var require_utils2 = __commonJS((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.nullObj = undefined;
	function nullObj() {
		var x = {};
		x.__proto__ = null;
		return x;
	}
	exports.nullObj = nullObj;
});

// node_modules/tseep/lib/ee.js
var require_ee = __commonJS((exports) => {
	var __spreadArray =
		(exports && exports.__spreadArray) ||
		((to, from, pack) => {
			if (pack || arguments.length === 2)
				for (var i = 0, l = from.length, ar; i < l; i++) {
					if (ar || !(i in from)) {
						if (!ar) ar = Array.prototype.slice.call(from, 0, i);
						ar[i] = from[i];
					}
				}
			return to.concat(ar || Array.prototype.slice.call(from));
		});
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.EventEmitter = undefined;
	var task_collection_1 = require_task_collection2();
	var utils_1 = require_utils();
	var utils_2 = require_utils2();
	function emit(event, a, b, c, d, e) {
		var ev = this.events[event];
		if (ev) {
			if (ev.length === 0) return false;
			if (ev.argsNum < 6) {
				ev.call(a, b, c, d, e);
			} else {
				var arr = new Array(ev.argsNum);
				for (var i = 0, len = arr.length; i < len; ++i) {
					arr[i] = arguments[i + 1];
				}
				ev.call.apply(undefined, arr);
			}
			return true;
		}
		return false;
	}
	function emitHasOnce(event, a, b, c, d, e) {
		var ev = this.events[event];
		var argsArr;
		if (ev !== undefined) {
			if (ev.length === 0) return false;
			if (ev.argsNum < 6) {
				ev.call(a, b, c, d, e);
			} else {
				argsArr = new Array(ev.argsNum);
				for (var i = 0, len = argsArr.length; i < len; ++i) {
					argsArr[i] = arguments[i + 1];
				}
				ev.call.apply(undefined, argsArr);
			}
		}
		var oev = this.onceEvents[event];
		if (oev) {
			if (typeof oev === "function") {
				this.onceEvents[event] = undefined;
				if (arguments.length < 6) {
					oev(a, b, c, d, e);
				} else {
					if (argsArr === undefined) {
						argsArr = new Array(arguments.length - 1);
						for (var i = 0, len = argsArr.length; i < len; ++i) {
							argsArr[i] = arguments[i + 1];
						}
					}
					oev.apply(undefined, argsArr);
				}
			} else {
				var fncs = oev;
				this.onceEvents[event] = undefined;
				if (arguments.length < 6) {
					for (var i = 0; i < fncs.length; ++i) {
						fncs[i](a, b, c, d, e);
					}
				} else {
					if (argsArr === undefined) {
						argsArr = new Array(arguments.length - 1);
						for (var i = 0, len = argsArr.length; i < len; ++i) {
							argsArr[i] = arguments[i + 1];
						}
					}
					for (var i = 0; i < fncs.length; ++i) {
						fncs[i].apply(undefined, argsArr);
					}
				}
			}
			return true;
		}
		return ev !== undefined;
	}
	var EventEmitter = (() => {
		function EventEmitter2() {
			this.events = (0, utils_2.nullObj)();
			this.onceEvents = (0, utils_2.nullObj)();
			this._symbolKeys = new Set();
			this.maxListeners = Number.POSITIVE_INFINITY;
		}
		Object.defineProperty(EventEmitter2.prototype, "_eventsCount", {
			get: function () {
				return this.eventNames().length;
			},
			enumerable: false,
			configurable: true,
		});
		return EventEmitter2;
	})();
	exports.EventEmitter = EventEmitter;
	function once(event, listener) {
		if (this.emit === emit) {
			this.emit = emitHasOnce;
		}
		switch (typeof this.onceEvents[event]) {
			case "undefined":
				this.onceEvents[event] = listener;
				if (typeof event === "symbol") this._symbolKeys.add(event);
				break;
			case "function":
				this.onceEvents[event] = [this.onceEvents[event], listener];
				break;
			case "object":
				this.onceEvents[event].push(listener);
		}
		return this;
	}
	function addListener(event, listener, argsNum) {
		if (argsNum === undefined) {
			argsNum = listener.length;
		}
		if (typeof listener !== "function")
			throw new TypeError("The listener must be a function");
		var evtmap = this.events[event];
		if (!evtmap) {
			this.events[event] = new task_collection_1.TaskCollection(
				argsNum,
				true,
				listener,
				false,
			);
			if (typeof event === "symbol") this._symbolKeys.add(event);
		} else {
			evtmap.push(listener);
			evtmap.growArgsNum(argsNum);
			if (
				this.maxListeners !== Number.POSITIVE_INFINITY &&
				this.maxListeners <= evtmap.length
			)
				console.warn(
					'Maximum event listeners for "'.concat(String(event), '" event!'),
				);
		}
		return this;
	}
	function removeListener(event, listener) {
		var evt = this.events[event];
		if (evt) {
			evt.removeLast(listener);
		}
		var evto = this.onceEvents[event];
		if (evto) {
			if (typeof evto === "function") {
				this.onceEvents[event] = undefined;
			} else if (typeof evto === "object") {
				if (evto.length === 1 && evto[0] === listener) {
					this.onceEvents[event] = undefined;
				} else {
					(0, utils_1._fast_remove_single)(evto, evto.lastIndexOf(listener));
				}
			}
		}
		return this;
	}
	function addListenerBound(event, listener, bindTo, argsNum) {
		if (bindTo === undefined) {
			bindTo = this;
		}
		if (argsNum === undefined) {
			argsNum = listener.length;
		}
		if (!this.boundFuncs) this.boundFuncs = new Map();
		var bound = listener.bind(bindTo);
		this.boundFuncs.set(listener, bound);
		return this.addListener(event, bound, argsNum);
	}
	function removeListenerBound(event, listener) {
		var _a2, _b;
		var bound =
			(_a2 = this.boundFuncs) === null || _a2 === undefined
				? undefined
				: _a2.get(listener);
		(_b = this.boundFuncs) === null || _b === undefined || _b.delete(listener);
		return this.removeListener(event, bound);
	}
	function hasListeners(event) {
		return this.events[event] && !!this.events[event].length;
	}
	function prependListener(event, listener, argsNum) {
		if (argsNum === undefined) {
			argsNum = listener.length;
		}
		if (typeof listener !== "function")
			throw new TypeError("The listener must be a function");
		var evtmap = this.events[event];
		if (!evtmap || !(evtmap instanceof task_collection_1.TaskCollection)) {
			evtmap = this.events[event] = new task_collection_1.TaskCollection(
				argsNum,
				true,
				listener,
				false,
			);
			if (typeof event === "symbol") this._symbolKeys.add(event);
		} else {
			evtmap.insert(0, listener);
			evtmap.growArgsNum(argsNum);
			if (
				this.maxListeners !== Number.POSITIVE_INFINITY &&
				this.maxListeners <= evtmap.length
			)
				console.warn(
					'Maximum event listeners for "'.concat(String(event), '" event!'),
				);
		}
		return this;
	}
	function prependOnceListener(event, listener) {
		if (this.emit === emit) {
			this.emit = emitHasOnce;
		}
		var evtmap = this.onceEvents[event];
		if (!evtmap) {
			this.onceEvents[event] = [listener];
			if (typeof event === "symbol") this._symbolKeys.add(event);
		} else if (typeof evtmap !== "object") {
			this.onceEvents[event] = [listener, evtmap];
			if (typeof event === "symbol") this._symbolKeys.add(event);
		} else {
			evtmap.unshift(listener);
			if (
				this.maxListeners !== Number.POSITIVE_INFINITY &&
				this.maxListeners <= evtmap.length
			) {
				console.warn(
					'Maximum event listeners for "'.concat(
						String(event),
						'" once event!',
					),
				);
			}
		}
		return this;
	}
	function removeAllListeners(event) {
		if (event === undefined) {
			this.events = (0, utils_2.nullObj)();
			this.onceEvents = (0, utils_2.nullObj)();
			this._symbolKeys = new Set();
		} else {
			this.events[event] = undefined;
			this.onceEvents[event] = undefined;
			if (typeof event === "symbol") this._symbolKeys.delete(event);
		}
		return this;
	}
	function setMaxListeners(n) {
		this.maxListeners = n;
		return this;
	}
	function getMaxListeners() {
		return this.maxListeners;
	}
	function listeners(event) {
		if (this.emit === emit)
			return this.events[event]
				? this.events[event].tasksAsArray().slice()
				: [];
		else {
			if (this.events[event] && this.onceEvents[event]) {
				return __spreadArray(
					__spreadArray([], this.events[event].tasksAsArray(), true),
					typeof this.onceEvents[event] === "function"
						? [this.onceEvents[event]]
						: this.onceEvents[event],
					true,
				);
			} else if (this.events[event]) return this.events[event].tasksAsArray();
			else if (this.onceEvents[event])
				return typeof this.onceEvents[event] === "function"
					? [this.onceEvents[event]]
					: this.onceEvents[event];
			else return [];
		}
	}
	function eventNames() {
		if (this.emit === emit) {
			var keys = Object.keys(this.events);
			return __spreadArray(
				__spreadArray([], keys, true),
				Array.from(this._symbolKeys),
				true,
			).filter(
				(x) => x in this.events && this.events[x] && this.events[x].length,
			);
		} else {
			var keys = Object.keys(this.events).filter(
				(x) => this.events[x] && this.events[x].length,
			);
			var keysO = Object.keys(this.onceEvents).filter(
				(x) => this.onceEvents[x] && this.onceEvents[x].length,
			);
			return __spreadArray(
				__spreadArray(__spreadArray([], keys, true), keysO, true),
				Array.from(this._symbolKeys).filter(
					(x) =>
						(x in this.events && this.events[x] && this.events[x].length) ||
						(x in this.onceEvents &&
							this.onceEvents[x] &&
							this.onceEvents[x].length),
				),
				true,
			);
		}
	}
	function listenerCount(type) {
		if (this.emit === emit)
			return (this.events[type] && this.events[type].length) || 0;
		else
			return (
				((this.events[type] && this.events[type].length) || 0) +
				((this.onceEvents[type] && this.onceEvents[type].length) || 0)
			);
	}
	EventEmitter.prototype.emit = emit;
	EventEmitter.prototype.on = addListener;
	EventEmitter.prototype.once = once;
	EventEmitter.prototype.addListener = addListener;
	EventEmitter.prototype.removeListener = removeListener;
	EventEmitter.prototype.addListenerBound = addListenerBound;
	EventEmitter.prototype.removeListenerBound = removeListenerBound;
	EventEmitter.prototype.hasListeners = hasListeners;
	EventEmitter.prototype.prependListener = prependListener;
	EventEmitter.prototype.prependOnceListener = prependOnceListener;
	EventEmitter.prototype.off = removeListener;
	EventEmitter.prototype.removeAllListeners = removeAllListeners;
	EventEmitter.prototype.setMaxListeners = setMaxListeners;
	EventEmitter.prototype.getMaxListeners = getMaxListeners;
	EventEmitter.prototype.listeners = listeners;
	EventEmitter.prototype.eventNames = eventNames;
	EventEmitter.prototype.listenerCount = listenerCount;
});

// node_modules/tseep/lib/index.js
var require_lib = __commonJS((exports) => {
	var __createBinding =
		(exports && exports.__createBinding) ||
		(Object.create
			? (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					var desc = Object.getOwnPropertyDescriptor(m, k);
					if (
						!desc ||
						("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
					) {
						desc = { enumerable: true, get: () => m[k] };
					}
					Object.defineProperty(o, k2, desc);
				}
			: (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					o[k2] = m[k];
				});
	var __exportStar =
		(exports && exports.__exportStar) ||
		((m, exports2) => {
			for (var p in m)
				if (
					p !== "default" &&
					!Object.prototype.hasOwnProperty.call(exports2, p)
				)
					__createBinding(exports2, m, p);
		});
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_types(), exports);
	__exportStar(require_ee(), exports);
});

// node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;
	module.exports = (val, options) => {
		options = options || {};
		var type = typeof val;
		if (type === "string" && val.length > 0) {
			return parse(val);
		} else if (type === "number" && isFinite(val)) {
			return options.long ? fmtLong(val) : fmtShort(val);
		}
		throw new Error(
			"val is not a non-empty string or a valid number. val=" +
				JSON.stringify(val),
		);
	};
	function parse(str) {
		str = String(str);
		if (str.length > 100) {
			return;
		}
		var match =
			/^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
				str,
			);
		if (!match) {
			return;
		}
		var n = Number.parseFloat(match[1]);
		var type = (match[2] || "ms").toLowerCase();
		switch (type) {
			case "years":
			case "year":
			case "yrs":
			case "yr":
			case "y":
				return n * y;
			case "weeks":
			case "week":
			case "w":
				return n * w;
			case "days":
			case "day":
			case "d":
				return n * d;
			case "hours":
			case "hour":
			case "hrs":
			case "hr":
			case "h":
				return n * h;
			case "minutes":
			case "minute":
			case "mins":
			case "min":
			case "m":
				return n * m;
			case "seconds":
			case "second":
			case "secs":
			case "sec":
			case "s":
				return n * s;
			case "milliseconds":
			case "millisecond":
			case "msecs":
			case "msec":
			case "ms":
				return n;
			default:
				return;
		}
	}
	function fmtShort(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) {
			return Math.round(ms / d) + "d";
		}
		if (msAbs >= h) {
			return Math.round(ms / h) + "h";
		}
		if (msAbs >= m) {
			return Math.round(ms / m) + "m";
		}
		if (msAbs >= s) {
			return Math.round(ms / s) + "s";
		}
		return ms + "ms";
	}
	function fmtLong(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) {
			return plural(ms, msAbs, d, "day");
		}
		if (msAbs >= h) {
			return plural(ms, msAbs, h, "hour");
		}
		if (msAbs >= m) {
			return plural(ms, msAbs, m, "minute");
		}
		if (msAbs >= s) {
			return plural(ms, msAbs, s, "second");
		}
		return ms + " ms";
	}
	function plural(ms, msAbs, n, name) {
		var isPlural = msAbs >= n * 1.5;
		return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
	}
});

// node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = require_ms();
		createDebug.destroy = destroy;
		Object.keys(env).forEach((key) => {
			createDebug[key] = env[key];
		});
		createDebug.names = [];
		createDebug.skips = [];
		createDebug.formatters = {};
		function selectColor(namespace) {
			let hash = 0;
			for (let i = 0; i < namespace.length; i++) {
				hash = (hash << 5) - hash + namespace.charCodeAt(i);
				hash |= 0;
			}
			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;
			function debug(...args) {
				if (!debug.enabled) {
					return;
				}
				const self = debug;
				const curr = Number(new Date());
				const ms = curr - (prevTime || curr);
				self.diff = ms;
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;
				args[0] = createDebug.coerce(args[0]);
				if (typeof args[0] !== "string") {
					args.unshift("%O");
				}
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					if (match === "%%") {
						return "%";
					}
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === "function") {
						const val = args[index];
						match = formatter.call(self, val);
						args.splice(index, 1);
						index--;
					}
					return match;
				});
				createDebug.formatArgs.call(self, args);
				const logFn = self.log || createDebug.log;
				logFn.apply(self, args);
			}
			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy;
			Object.defineProperty(debug, "enabled", {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) {
						return enableOverride;
					}
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}
					return enabledCache;
				},
				set: (v) => {
					enableOverride = v;
				},
			});
			if (typeof createDebug.init === "function") {
				createDebug.init(debug);
			}
			return debug;
		}
		function extend(namespace, delimiter) {
			const newDebug = createDebug(
				this.namespace +
					(typeof delimiter === "undefined" ? ":" : delimiter) +
					namespace,
			);
			newDebug.log = this.log;
			return newDebug;
		}
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;
			createDebug.names = [];
			createDebug.skips = [];
			const split = (typeof namespaces === "string" ? namespaces : "")
				.trim()
				.replace(" ", ",")
				.split(",")
				.filter(Boolean);
			for (const ns of split) {
				if (ns[0] === "-") {
					createDebug.skips.push(ns.slice(1));
				} else {
					createDebug.names.push(ns);
				}
			}
		}
		function matchesTemplate(search, template) {
			let searchIndex = 0;
			let templateIndex = 0;
			let starIndex = -1;
			let matchIndex = 0;
			while (searchIndex < search.length) {
				if (
					templateIndex < template.length &&
					(template[templateIndex] === search[searchIndex] ||
						template[templateIndex] === "*")
				) {
					if (template[templateIndex] === "*") {
						starIndex = templateIndex;
						matchIndex = searchIndex;
						templateIndex++;
					} else {
						searchIndex++;
						templateIndex++;
					}
				} else if (starIndex !== -1) {
					templateIndex = starIndex + 1;
					matchIndex++;
					searchIndex = matchIndex;
				} else {
					return false;
				}
			}
			while (
				templateIndex < template.length &&
				template[templateIndex] === "*"
			) {
				templateIndex++;
			}
			return templateIndex === template.length;
		}
		function disable() {
			const namespaces = [
				...createDebug.names,
				...createDebug.skips.map((namespace) => "-" + namespace),
			].join(",");
			createDebug.enable("");
			return namespaces;
		}
		function enabled(name) {
			for (const skip of createDebug.skips) {
				if (matchesTemplate(name, skip)) {
					return false;
				}
			}
			for (const ns of createDebug.names) {
				if (matchesTemplate(name, ns)) {
					return true;
				}
			}
			return false;
		}
		function coerce(val) {
			if (val instanceof Error) {
				return val.stack || val.message;
			}
			return val;
		}
		function destroy() {
			console.warn(
				"Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
			);
		}
		createDebug.enable(createDebug.load());
		return createDebug;
	}
	module.exports = setup;
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = localstorage();
	exports.destroy = (() => {
		let warned = false;
		return () => {
			if (!warned) {
				warned = true;
				console.warn(
					"Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
				);
			}
		};
	})();
	exports.colors = [
		"#0000CC",
		"#0000FF",
		"#0033CC",
		"#0033FF",
		"#0066CC",
		"#0066FF",
		"#0099CC",
		"#0099FF",
		"#00CC00",
		"#00CC33",
		"#00CC66",
		"#00CC99",
		"#00CCCC",
		"#00CCFF",
		"#3300CC",
		"#3300FF",
		"#3333CC",
		"#3333FF",
		"#3366CC",
		"#3366FF",
		"#3399CC",
		"#3399FF",
		"#33CC00",
		"#33CC33",
		"#33CC66",
		"#33CC99",
		"#33CCCC",
		"#33CCFF",
		"#6600CC",
		"#6600FF",
		"#6633CC",
		"#6633FF",
		"#66CC00",
		"#66CC33",
		"#9900CC",
		"#9900FF",
		"#9933CC",
		"#9933FF",
		"#99CC00",
		"#99CC33",
		"#CC0000",
		"#CC0033",
		"#CC0066",
		"#CC0099",
		"#CC00CC",
		"#CC00FF",
		"#CC3300",
		"#CC3333",
		"#CC3366",
		"#CC3399",
		"#CC33CC",
		"#CC33FF",
		"#CC6600",
		"#CC6633",
		"#CC9900",
		"#CC9933",
		"#CCCC00",
		"#CCCC33",
		"#FF0000",
		"#FF0033",
		"#FF0066",
		"#FF0099",
		"#FF00CC",
		"#FF00FF",
		"#FF3300",
		"#FF3333",
		"#FF3366",
		"#FF3399",
		"#FF33CC",
		"#FF33FF",
		"#FF6600",
		"#FF6633",
		"#FF9900",
		"#FF9933",
		"#FFCC00",
		"#FFCC33",
	];
	function useColors() {
		if (
			typeof window !== "undefined" &&
			window.process &&
			(window.process.type === "renderer" || window.process.__nwjs)
		) {
			return true;
		}
		if (
			typeof navigator !== "undefined" &&
			navigator.userAgent &&
			navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
		) {
			return false;
		}
		let m;
		return (
			(typeof document !== "undefined" &&
				document.documentElement &&
				document.documentElement.style &&
				document.documentElement.style.WebkitAppearance) ||
			(typeof window !== "undefined" &&
				window.console &&
				(window.console.firebug ||
					(window.console.exception && window.console.table))) ||
			(typeof navigator !== "undefined" &&
				navigator.userAgent &&
				(m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
				Number.parseInt(m[1], 10) >= 31) ||
			(typeof navigator !== "undefined" &&
				navigator.userAgent &&
				navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
		);
	}
	function formatArgs(args) {
		args[0] =
			(this.useColors ? "%c" : "") +
			this.namespace +
			(this.useColors ? " %c" : " ") +
			args[0] +
			(this.useColors ? "%c " : " ") +
			"+" +
			module.exports.humanize(this.diff);
		if (!this.useColors) {
			return;
		}
		const c = "color: " + this.color;
		args.splice(1, 0, c, "color: inherit");
		let index = 0;
		let lastC = 0;
		args[0].replace(/%[a-zA-Z%]/g, (match) => {
			if (match === "%%") {
				return;
			}
			index++;
			if (match === "%c") {
				lastC = index;
			}
		});
		args.splice(lastC, 0, c);
	}
	exports.log = console.debug || console.log || (() => {});
	function save(namespaces) {
		try {
			if (namespaces) {
				exports.storage.setItem("debug", namespaces);
			} else {
				exports.storage.removeItem("debug");
			}
		} catch (error) {}
	}
	function load() {
		let r;
		try {
			r = exports.storage.getItem("debug");
		} catch (error) {}
		if (!r && typeof process !== "undefined" && "env" in process) {
			r = process.env.DEBUG;
		}
		return r;
	}
	function localstorage() {
		try {
			return localStorage;
		} catch (error) {}
	}
	module.exports = require_common()(exports);
	var { formatters } = module.exports;
	formatters.j = (v) => {
		try {
			return JSON.stringify(v);
		} catch (error) {
			return "[UnexpectedJSONParseError]: " + error.message;
		}
	};
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS((exports, module) => {
	module.exports = (flag, argv = process.argv) => {
		const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
		const position = argv.indexOf(prefix + flag);
		const terminatorPosition = argv.indexOf("--");
		return (
			position !== -1 &&
			(terminatorPosition === -1 || position < terminatorPosition)
		);
	};
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS((exports, module) => {
	var os = __require("os");
	var tty = __require("tty");
	var hasFlag = require_has_flag();
	var { env } = process;
	var forceColor;
	if (
		hasFlag("no-color") ||
		hasFlag("no-colors") ||
		hasFlag("color=false") ||
		hasFlag("color=never")
	) {
		forceColor = 0;
	} else if (
		hasFlag("color") ||
		hasFlag("colors") ||
		hasFlag("color=true") ||
		hasFlag("color=always")
	) {
		forceColor = 1;
	}
	if ("FORCE_COLOR" in env) {
		if (env.FORCE_COLOR === "true") {
			forceColor = 1;
		} else if (env.FORCE_COLOR === "false") {
			forceColor = 0;
		} else {
			forceColor =
				env.FORCE_COLOR.length === 0
					? 1
					: Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
		}
	}
	function translateLevel(level) {
		if (level === 0) {
			return false;
		}
		return {
			level,
			hasBasic: true,
			has256: level >= 2,
			has16m: level >= 3,
		};
	}
	function supportsColor(haveStream, streamIsTTY) {
		if (forceColor === 0) {
			return 0;
		}
		if (
			hasFlag("color=16m") ||
			hasFlag("color=full") ||
			hasFlag("color=truecolor")
		) {
			return 3;
		}
		if (hasFlag("color=256")) {
			return 2;
		}
		if (haveStream && !streamIsTTY && forceColor === undefined) {
			return 0;
		}
		const min = forceColor || 0;
		if (env.TERM === "dumb") {
			return min;
		}
		if (process.platform === "win32") {
			const osRelease = os.release().split(".");
			if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
				return Number(osRelease[2]) >= 14931 ? 3 : 2;
			}
			return 1;
		}
		if ("CI" in env) {
			if (
				[
					"TRAVIS",
					"CIRCLECI",
					"APPVEYOR",
					"GITLAB_CI",
					"GITHUB_ACTIONS",
					"BUILDKITE",
				].some((sign) => sign in env) ||
				env.CI_NAME === "codeship"
			) {
				return 1;
			}
			return min;
		}
		if ("TEAMCITY_VERSION" in env) {
			return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
		}
		if (env.COLORTERM === "truecolor") {
			return 3;
		}
		if ("TERM_PROGRAM" in env) {
			const version = Number.parseInt(
				(env.TERM_PROGRAM_VERSION || "").split(".")[0],
				10,
			);
			switch (env.TERM_PROGRAM) {
				case "iTerm.app":
					return version >= 3 ? 3 : 2;
				case "Apple_Terminal":
					return 2;
			}
		}
		if (/-256(color)?$/i.test(env.TERM)) {
			return 2;
		}
		if (
			/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(
				env.TERM,
			)
		) {
			return 1;
		}
		if ("COLORTERM" in env) {
			return 1;
		}
		return min;
	}
	function getSupportLevel(stream) {
		const level = supportsColor(stream, stream && stream.isTTY);
		return translateLevel(level);
	}
	module.exports = {
		supportsColor: getSupportLevel,
		stdout: translateLevel(supportsColor(true, tty.isatty(1))),
		stderr: translateLevel(supportsColor(true, tty.isatty(2))),
	};
});

// node_modules/debug/src/node.js
var require_node = __commonJS((exports, module) => {
	var tty = __require("tty");
	var util = __require("util");
	exports.init = init;
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.destroy = util.deprecate(
		() => {},
		"Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
	);
	exports.colors = [6, 2, 3, 4, 5, 1];
	try {
		const supportsColor = require_supports_color();
		if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
			exports.colors = [
				20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63,
				68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128,
				129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
				169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
				201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
			];
		}
	} catch (error) {}
	exports.inspectOpts = Object.keys(process.env)
		.filter((key) => {
			return /^debug_/i.test(key);
		})
		.reduce((obj, key) => {
			const prop = key
				.substring(6)
				.toLowerCase()
				.replace(/_([a-z])/g, (_, k) => {
					return k.toUpperCase();
				});
			let val = process.env[key];
			if (/^(yes|on|true|enabled)$/i.test(val)) {
				val = true;
			} else if (/^(no|off|false|disabled)$/i.test(val)) {
				val = false;
			} else if (val === "null") {
				val = null;
			} else {
				val = Number(val);
			}
			obj[prop] = val;
			return obj;
		}, {});
	function useColors() {
		return "colors" in exports.inspectOpts
			? Boolean(exports.inspectOpts.colors)
			: tty.isatty(process.stderr.fd);
	}
	function formatArgs(args) {
		const { namespace: name, useColors: useColors2 } = this;
		if (useColors2) {
			const c = this.color;
			const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
			const prefix = `  ${colorCode};1m${name} \x1B[0m`;
			args[0] =
				prefix +
				args[0]
					.split(`
`)
					.join(
						`
` + prefix,
					);
			args.push(
				colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m",
			);
		} else {
			args[0] = getDate() + name + " " + args[0];
		}
	}
	function getDate() {
		if (exports.inspectOpts.hideDate) {
			return "";
		}
		return new Date().toISOString() + " ";
	}
	function log(...args) {
		return process.stderr.write(
			util.formatWithOptions(exports.inspectOpts, ...args) +
				`
`,
		);
	}
	function save(namespaces) {
		if (namespaces) {
			process.env.DEBUG = namespaces;
		} else {
			delete process.env.DEBUG;
		}
	}
	function load() {
		return process.env.DEBUG;
	}
	function init(debug) {
		debug.inspectOpts = {};
		const keys = Object.keys(exports.inspectOpts);
		for (let i = 0; i < keys.length; i++) {
			debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
		}
	}
	module.exports = require_common()(exports);
	var { formatters } = module.exports;
	formatters.o = function (v) {
		this.inspectOpts.colors = this.useColors;
		return util
			.inspect(v, this.inspectOpts)
			.split(`
`)
			.map((str) => str.trim())
			.join(" ");
	};
	formatters.O = function (v) {
		this.inspectOpts.colors = this.useColors;
		return util.inspect(v, this.inspectOpts);
	};
});

// node_modules/debug/src/index.js
var require_src = __commonJS((exports, module) => {
	if (
		typeof process === "undefined" ||
		process.type === "renderer" ||
		false ||
		process.__nwjs
	) {
		module.exports = require_browser();
	} else {
		module.exports = require_node();
	}
});

// node_modules/typescript-lru-cache/dist/LRUCacheNode.js
var require_LRUCacheNode = __commonJS((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.LRUCacheNode = undefined;

	class LRUCacheNode {
		constructor(key, value, options) {
			const {
				entryExpirationTimeInMS = null,
				next = null,
				prev = null,
				onEntryEvicted,
				onEntryMarkedAsMostRecentlyUsed,
				clone,
				cloneFn,
			} = options !== null && options !== undefined ? options : {};
			if (
				typeof entryExpirationTimeInMS === "number" &&
				(entryExpirationTimeInMS <= 0 || Number.isNaN(entryExpirationTimeInMS))
			) {
				throw new Error(
					"entryExpirationTimeInMS must either be null (no expiry) or greater than 0",
				);
			}
			this.clone = clone !== null && clone !== undefined ? clone : false;
			this.cloneFn =
				cloneFn !== null && cloneFn !== undefined ? cloneFn : this.defaultClone;
			this.key = key;
			this.internalValue = this.clone ? this.cloneFn(value) : value;
			this.created = Date.now();
			this.entryExpirationTimeInMS = entryExpirationTimeInMS;
			this.next = next;
			this.prev = prev;
			this.onEntryEvicted = onEntryEvicted;
			this.onEntryMarkedAsMostRecentlyUsed = onEntryMarkedAsMostRecentlyUsed;
		}
		get value() {
			return this.clone ? this.cloneFn(this.internalValue) : this.internalValue;
		}
		get isExpired() {
			return (
				typeof this.entryExpirationTimeInMS === "number" &&
				Date.now() - this.created > this.entryExpirationTimeInMS
			);
		}
		invokeOnEvicted() {
			if (this.onEntryEvicted) {
				const { key, value, isExpired } = this;
				this.onEntryEvicted({ key, value, isExpired });
			}
		}
		invokeOnEntryMarkedAsMostRecentlyUsed() {
			if (this.onEntryMarkedAsMostRecentlyUsed) {
				const { key, value } = this;
				this.onEntryMarkedAsMostRecentlyUsed({ key, value });
			}
		}
		defaultClone(value) {
			if (
				typeof value === "boolean" ||
				typeof value === "string" ||
				typeof value === "number"
			) {
				return value;
			}
			return JSON.parse(JSON.stringify(value));
		}
	}
	exports.LRUCacheNode = LRUCacheNode;
});

// node_modules/typescript-lru-cache/dist/LRUCache.js
var require_LRUCache = __commonJS((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.LRUCache = undefined;
	var LRUCacheNode_1 = require_LRUCacheNode();

	class LRUCache {
		constructor(options) {
			this.lookupTable = new Map();
			this.head = null;
			this.tail = null;
			const {
				maxSize = 25,
				entryExpirationTimeInMS = null,
				onEntryEvicted,
				onEntryMarkedAsMostRecentlyUsed,
				cloneFn,
				clone,
			} = options !== null && options !== undefined ? options : {};
			if (Number.isNaN(maxSize) || maxSize <= 0) {
				throw new Error("maxSize must be greater than 0.");
			}
			if (
				typeof entryExpirationTimeInMS === "number" &&
				(entryExpirationTimeInMS <= 0 || Number.isNaN(entryExpirationTimeInMS))
			) {
				throw new Error(
					"entryExpirationTimeInMS must either be null (no expiry) or greater than 0",
				);
			}
			this.maxSizeInternal = maxSize;
			this.entryExpirationTimeInMS = entryExpirationTimeInMS;
			this.onEntryEvicted = onEntryEvicted;
			this.onEntryMarkedAsMostRecentlyUsed = onEntryMarkedAsMostRecentlyUsed;
			this.clone = clone;
			this.cloneFn = cloneFn;
		}
		get size() {
			this.cleanCache();
			return this.lookupTable.size;
		}
		get remainingSize() {
			return this.maxSizeInternal - this.size;
		}
		get newest() {
			if (!this.head) {
				return null;
			}
			if (this.head.isExpired) {
				this.removeNodeFromListAndLookupTable(this.head);
				return this.newest;
			}
			return this.mapNodeToEntry(this.head);
		}
		get oldest() {
			if (!this.tail) {
				return null;
			}
			if (this.tail.isExpired) {
				this.removeNodeFromListAndLookupTable(this.tail);
				return this.oldest;
			}
			return this.mapNodeToEntry(this.tail);
		}
		get maxSize() {
			return this.maxSizeInternal;
		}
		set maxSize(value) {
			if (Number.isNaN(value) || value <= 0) {
				throw new Error("maxSize must be greater than 0.");
			}
			this.maxSizeInternal = value;
			this.enforceSizeLimit();
		}
		set(key, value, entryOptions) {
			const currentNodeForKey = this.lookupTable.get(key);
			if (currentNodeForKey) {
				this.removeNodeFromListAndLookupTable(currentNodeForKey);
			}
			const node = new LRUCacheNode_1.LRUCacheNode(key, value, {
				entryExpirationTimeInMS: this.entryExpirationTimeInMS,
				onEntryEvicted: this.onEntryEvicted,
				onEntryMarkedAsMostRecentlyUsed: this.onEntryMarkedAsMostRecentlyUsed,
				clone: this.clone,
				cloneFn: this.cloneFn,
				...entryOptions,
			});
			this.setNodeAsHead(node);
			this.lookupTable.set(key, node);
			this.enforceSizeLimit();
			return this;
		}
		get(key) {
			const node = this.lookupTable.get(key);
			if (!node) {
				return null;
			}
			if (node.isExpired) {
				this.removeNodeFromListAndLookupTable(node);
				return null;
			}
			this.setNodeAsHead(node);
			return node.value;
		}
		peek(key) {
			const node = this.lookupTable.get(key);
			if (!node) {
				return null;
			}
			if (node.isExpired) {
				this.removeNodeFromListAndLookupTable(node);
				return null;
			}
			return node.value;
		}
		delete(key) {
			const node = this.lookupTable.get(key);
			if (!node) {
				return false;
			}
			return this.removeNodeFromListAndLookupTable(node);
		}
		has(key) {
			const node = this.lookupTable.get(key);
			if (!node) {
				return false;
			}
			if (node.isExpired) {
				this.removeNodeFromListAndLookupTable(node);
				return false;
			}
			return true;
		}
		clear() {
			this.head = null;
			this.tail = null;
			this.lookupTable.clear();
		}
		find(condition) {
			let node = this.head;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				const entry = this.mapNodeToEntry(node);
				if (condition(entry)) {
					this.setNodeAsHead(node);
					return entry;
				}
				node = node.next;
			}
			return null;
		}
		forEach(callback) {
			let node = this.head;
			let index = 0;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				callback(node.value, node.key, index);
				node = node.next;
				index++;
			}
		}
		*values() {
			let node = this.head;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				yield node.value;
				node = node.next;
			}
		}
		*keys() {
			let node = this.head;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				yield node.key;
				node = node.next;
			}
		}
		*entries() {
			let node = this.head;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				yield this.mapNodeToEntry(node);
				node = node.next;
			}
		}
		*[Symbol.iterator]() {
			let node = this.head;
			while (node) {
				if (node.isExpired) {
					const next = node.next;
					this.removeNodeFromListAndLookupTable(node);
					node = next;
					continue;
				}
				yield this.mapNodeToEntry(node);
				node = node.next;
			}
		}
		enforceSizeLimit() {
			let node = this.tail;
			while (node !== null && this.size > this.maxSizeInternal) {
				const prev = node.prev;
				this.removeNodeFromListAndLookupTable(node);
				node = prev;
			}
		}
		mapNodeToEntry({ key, value }) {
			return {
				key,
				value,
			};
		}
		setNodeAsHead(node) {
			this.removeNodeFromList(node);
			if (!this.head) {
				this.head = node;
				this.tail = node;
			} else {
				node.next = this.head;
				this.head.prev = node;
				this.head = node;
			}
			node.invokeOnEntryMarkedAsMostRecentlyUsed();
		}
		removeNodeFromList(node) {
			if (node.prev !== null) {
				node.prev.next = node.next;
			}
			if (node.next !== null) {
				node.next.prev = node.prev;
			}
			if (this.head === node) {
				this.head = node.next;
			}
			if (this.tail === node) {
				this.tail = node.prev;
			}
			node.next = null;
			node.prev = null;
		}
		removeNodeFromListAndLookupTable(node) {
			node.invokeOnEvicted();
			this.removeNodeFromList(node);
			return this.lookupTable.delete(node.key);
		}
		cleanCache() {
			if (!this.entryExpirationTimeInMS) {
				return;
			}
			const expiredNodes = [];
			for (const node of this.lookupTable.values()) {
				if (node.isExpired) {
					expiredNodes.push(node);
				}
			}
			expiredNodes.forEach((node) =>
				this.removeNodeFromListAndLookupTable(node),
			);
		}
	}
	exports.LRUCache = LRUCache;
});

// node_modules/typescript-lru-cache/dist/index.js
var require_dist = __commonJS((exports) => {
	var __createBinding =
		(exports && exports.__createBinding) ||
		(Object.create
			? (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					var desc = Object.getOwnPropertyDescriptor(m, k);
					if (
						!desc ||
						("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
					) {
						desc = { enumerable: true, get: () => m[k] };
					}
					Object.defineProperty(o, k2, desc);
				}
			: (o, m, k, k2) => {
					if (k2 === undefined) k2 = k;
					o[k2] = m[k];
				});
	var __exportStar =
		(exports && exports.__exportStar) ||
		((m, exports2) => {
			for (var p in m)
				if (
					p !== "default" &&
					!Object.prototype.hasOwnProperty.call(exports2, p)
				)
					__createBinding(exports2, m, p);
		});
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_LRUCache(), exports);
});

// node_modules/light-bolt11-decoder/node_modules/@scure/base/lib/index.js
var require_lib2 = __commonJS((exports) => {
	/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.bytes =
		exports.stringToBytes =
		exports.str =
		exports.bytesToString =
		exports.hex =
		exports.utf8 =
		exports.bech32m =
		exports.bech32 =
		exports.base58check =
		exports.base58xmr =
		exports.base58xrp =
		exports.base58flickr =
		exports.base58 =
		exports.base64url =
		exports.base64 =
		exports.base32crockford =
		exports.base32hex =
		exports.base32 =
		exports.base16 =
		exports.utils =
		exports.assertNumber =
			undefined;
	function assertNumber2(n) {
		if (!Number.isSafeInteger(n)) throw new Error(`Wrong integer: ${n}`);
	}
	exports.assertNumber = assertNumber2;
	function chain2(...args) {
		const wrap = (a, b) => (c) => a(b(c));
		const encode = Array.from(args)
			.reverse()
			.reduce((acc, i2) => (acc ? wrap(acc, i2.encode) : i2.encode), undefined);
		const decode2 = args.reduce(
			(acc, i2) => (acc ? wrap(acc, i2.decode) : i2.decode),
			undefined,
		);
		return { encode, decode: decode2 };
	}
	function alphabet2(alphabet3) {
		return {
			encode: (digits) => {
				if (
					!Array.isArray(digits) ||
					(digits.length && typeof digits[0] !== "number")
				)
					throw new Error(
						"alphabet.encode input should be an array of numbers",
					);
				return digits.map((i2) => {
					assertNumber2(i2);
					if (i2 < 0 || i2 >= alphabet3.length)
						throw new Error(
							`Digit index outside alphabet: ${i2} (alphabet: ${alphabet3.length})`,
						);
					return alphabet3[i2];
				});
			},
			decode: (input) => {
				if (
					!Array.isArray(input) ||
					(input.length && typeof input[0] !== "string")
				)
					throw new Error("alphabet.decode input should be array of strings");
				return input.map((letter) => {
					if (typeof letter !== "string")
						throw new Error(`alphabet.decode: not string element=${letter}`);
					const index = alphabet3.indexOf(letter);
					if (index === -1)
						throw new Error(
							`Unknown letter: "${letter}". Allowed: ${alphabet3}`,
						);
					return index;
				});
			},
		};
	}
	function join2(separator = "") {
		if (typeof separator !== "string")
			throw new Error("join separator should be string");
		return {
			encode: (from) => {
				if (
					!Array.isArray(from) ||
					(from.length && typeof from[0] !== "string")
				)
					throw new Error("join.encode input should be array of strings");
				for (const i2 of from)
					if (typeof i2 !== "string")
						throw new Error(`join.encode: non-string input=${i2}`);
				return from.join(separator);
			},
			decode: (to) => {
				if (typeof to !== "string")
					throw new Error("join.decode input should be string");
				return to.split(separator);
			},
		};
	}
	function padding2(bits, chr = "=") {
		assertNumber2(bits);
		if (typeof chr !== "string")
			throw new Error("padding chr should be string");
		return {
			encode(data) {
				if (
					!Array.isArray(data) ||
					(data.length && typeof data[0] !== "string")
				)
					throw new Error("padding.encode input should be array of strings");
				for (const i2 of data)
					if (typeof i2 !== "string")
						throw new Error(`padding.encode: non-string input=${i2}`);
				while ((data.length * bits) % 8) data.push(chr);
				return data;
			},
			decode(input) {
				if (
					!Array.isArray(input) ||
					(input.length && typeof input[0] !== "string")
				)
					throw new Error("padding.encode input should be array of strings");
				for (const i2 of input)
					if (typeof i2 !== "string")
						throw new Error(`padding.decode: non-string input=${i2}`);
				let end = input.length;
				if ((end * bits) % 8)
					throw new Error(
						"Invalid padding: string should have whole number of bytes",
					);
				for (; end > 0 && input[end - 1] === chr; end--) {
					if (!(((end - 1) * bits) % 8))
						throw new Error("Invalid padding: string has too much padding");
				}
				return input.slice(0, end);
			},
		};
	}
	function normalize2(fn) {
		if (typeof fn !== "function")
			throw new Error("normalize fn should be function");
		return { encode: (from) => from, decode: (to) => fn(to) };
	}
	function convertRadix3(data, from, to) {
		if (from < 2)
			throw new Error(
				`convertRadix: wrong from=${from}, base cannot be less than 2`,
			);
		if (to < 2)
			throw new Error(
				`convertRadix: wrong to=${to}, base cannot be less than 2`,
			);
		if (!Array.isArray(data))
			throw new Error("convertRadix: data should be array");
		if (!data.length) return [];
		let pos = 0;
		const res = [];
		const digits = Array.from(data);
		digits.forEach((d) => {
			assertNumber2(d);
			if (d < 0 || d >= from) throw new Error(`Wrong integer: ${d}`);
		});
		while (true) {
			let carry = 0;
			let done = true;
			for (let i2 = pos; i2 < digits.length; i2++) {
				const digit = digits[i2];
				const digitBase = from * carry + digit;
				if (
					!Number.isSafeInteger(digitBase) ||
					(from * carry) / from !== carry ||
					digitBase - digit !== from * carry
				) {
					throw new Error("convertRadix: carry overflow");
				}
				carry = digitBase % to;
				digits[i2] = Math.floor(digitBase / to);
				if (
					!Number.isSafeInteger(digits[i2]) ||
					digits[i2] * to + carry !== digitBase
				)
					throw new Error("convertRadix: carry overflow");
				if (!done) continue;
				else if (!digits[i2]) pos = i2;
				else done = false;
			}
			res.push(carry);
			if (done) break;
		}
		for (let i2 = 0; i2 < data.length - 1 && data[i2] === 0; i2++) res.push(0);
		return res.reverse();
	}
	var gcd2 = (a, b) => (!b ? a : gcd2(b, a % b));
	var radix2carry2 = (from, to) => from + (to - gcd2(from, to));
	function convertRadix22(data, from, to, padding3) {
		if (!Array.isArray(data))
			throw new Error("convertRadix2: data should be array");
		if (from <= 0 || from > 32)
			throw new Error(`convertRadix2: wrong from=${from}`);
		if (to <= 0 || to > 32) throw new Error(`convertRadix2: wrong to=${to}`);
		if (radix2carry2(from, to) > 32) {
			throw new Error(
				`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry2(from, to)}`,
			);
		}
		let carry = 0;
		let pos = 0;
		const mask = 2 ** to - 1;
		const res = [];
		for (const n of data) {
			assertNumber2(n);
			if (n >= 2 ** from)
				throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
			carry = (carry << from) | n;
			if (pos + from > 32)
				throw new Error(
					`convertRadix2: carry overflow pos=${pos} from=${from}`,
				);
			pos += from;
			for (; pos >= to; pos -= to)
				res.push(((carry >> (pos - to)) & mask) >>> 0);
			carry &= 2 ** pos - 1;
		}
		carry = (carry << (to - pos)) & mask;
		if (!padding3 && pos >= from) throw new Error("Excess padding");
		if (!padding3 && carry) throw new Error(`Non-zero padding: ${carry}`);
		if (padding3 && pos > 0) res.push(carry >>> 0);
		return res;
	}
	function radix3(num2) {
		assertNumber2(num2);
		return {
			encode: (bytes4) => {
				if (!(bytes4 instanceof Uint8Array))
					throw new Error("radix.encode input should be Uint8Array");
				return convertRadix3(Array.from(bytes4), 2 ** 8, num2);
			},
			decode: (digits) => {
				if (
					!Array.isArray(digits) ||
					(digits.length && typeof digits[0] !== "number")
				)
					throw new Error("radix.decode input should be array of strings");
				return Uint8Array.from(convertRadix3(digits, num2, 2 ** 8));
			},
		};
	}
	function radix22(bits, revPadding = false) {
		assertNumber2(bits);
		if (bits <= 0 || bits > 32)
			throw new Error("radix2: bits should be in (0..32]");
		if (radix2carry2(8, bits) > 32 || radix2carry2(bits, 8) > 32)
			throw new Error("radix2: carry overflow");
		return {
			encode: (bytes4) => {
				if (!(bytes4 instanceof Uint8Array))
					throw new Error("radix2.encode input should be Uint8Array");
				return convertRadix22(Array.from(bytes4), 8, bits, !revPadding);
			},
			decode: (digits) => {
				if (
					!Array.isArray(digits) ||
					(digits.length && typeof digits[0] !== "number")
				)
					throw new Error("radix2.decode input should be array of strings");
				return Uint8Array.from(convertRadix22(digits, bits, 8, revPadding));
			},
		};
	}
	function unsafeWrapper2(fn) {
		if (typeof fn !== "function")
			throw new Error("unsafeWrapper fn should be function");
		return (...args) => {
			try {
				return fn.apply(null, args);
			} catch (e) {}
		};
	}
	function checksum(len, fn) {
		assertNumber2(len);
		if (typeof fn !== "function")
			throw new Error("checksum fn should be function");
		return {
			encode(data) {
				if (!(data instanceof Uint8Array))
					throw new Error("checksum.encode: input should be Uint8Array");
				const checksum2 = fn(data).slice(0, len);
				const res = new Uint8Array(data.length + len);
				res.set(data);
				res.set(checksum2, data.length);
				return res;
			},
			decode(data) {
				if (!(data instanceof Uint8Array))
					throw new Error("checksum.decode: input should be Uint8Array");
				const payload = data.slice(0, -len);
				const newChecksum = fn(payload).slice(0, len);
				const oldChecksum = data.slice(-len);
				for (let i2 = 0; i2 < len; i2++)
					if (newChecksum[i2] !== oldChecksum[i2])
						throw new Error("Invalid checksum");
				return payload;
			},
		};
	}
	exports.utils = {
		alphabet: alphabet2,
		chain: chain2,
		checksum,
		radix: radix3,
		radix2: radix22,
		join: join2,
		padding: padding2,
	};
	exports.base16 = chain2(radix22(4), alphabet2("0123456789ABCDEF"), join2(""));
	exports.base32 = chain2(
		radix22(5),
		alphabet2("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"),
		padding2(5),
		join2(""),
	);
	exports.base32hex = chain2(
		radix22(5),
		alphabet2("0123456789ABCDEFGHIJKLMNOPQRSTUV"),
		padding2(5),
		join2(""),
	);
	exports.base32crockford = chain2(
		radix22(5),
		alphabet2("0123456789ABCDEFGHJKMNPQRSTVWXYZ"),
		join2(""),
		normalize2((s) => s.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1")),
	);
	exports.base64 = chain2(
		radix22(6),
		alphabet2(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
		),
		padding2(6),
		join2(""),
	);
	exports.base64url = chain2(
		radix22(6),
		alphabet2(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
		),
		padding2(6),
		join2(""),
	);
	var genBase582 = (abc) => chain2(radix3(58), alphabet2(abc), join2(""));
	exports.base58 = genBase582(
		"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
	);
	exports.base58flickr = genBase582(
		"123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
	);
	exports.base58xrp = genBase582(
		"rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz",
	);
	var XMR_BLOCK_LEN2 = [0, 2, 3, 5, 6, 7, 9, 10, 11];
	exports.base58xmr = {
		encode(data) {
			let res = "";
			for (let i2 = 0; i2 < data.length; i2 += 8) {
				const block = data.subarray(i2, i2 + 8);
				res += exports.base58
					.encode(block)
					.padStart(XMR_BLOCK_LEN2[block.length], "1");
			}
			return res;
		},
		decode(str) {
			let res = [];
			for (let i2 = 0; i2 < str.length; i2 += 11) {
				const slice = str.slice(i2, i2 + 11);
				const blockLen = XMR_BLOCK_LEN2.indexOf(slice.length);
				const block = exports.base58.decode(slice);
				for (let j = 0; j < block.length - blockLen; j++) {
					if (block[j] !== 0) throw new Error("base58xmr: wrong padding");
				}
				res = res.concat(Array.from(block.slice(block.length - blockLen)));
			}
			return Uint8Array.from(res);
		},
	};
	var base58check = (sha2565) =>
		chain2(
			checksum(4, (data) => sha2565(sha2565(data))),
			exports.base58,
		);
	exports.base58check = base58check;
	var BECH_ALPHABET2 = chain2(
		alphabet2("qpzry9x8gf2tvdw0s3jn54khce6mua7l"),
		join2(""),
	);
	var POLYMOD_GENERATORS2 = [
		996825010, 642813549, 513874426, 1027748829, 705979059,
	];
	function bech32Polymod2(pre) {
		const b = pre >> 25;
		let chk = (pre & 33554431) << 5;
		for (let i2 = 0; i2 < POLYMOD_GENERATORS2.length; i2++) {
			if (((b >> i2) & 1) === 1) chk ^= POLYMOD_GENERATORS2[i2];
		}
		return chk;
	}
	function bechChecksum2(prefix, words, encodingConst = 1) {
		const len = prefix.length;
		let chk = 1;
		for (let i2 = 0; i2 < len; i2++) {
			const c = prefix.charCodeAt(i2);
			if (c < 33 || c > 126) throw new Error(`Invalid prefix (${prefix})`);
			chk = bech32Polymod2(chk) ^ (c >> 5);
		}
		chk = bech32Polymod2(chk);
		for (let i2 = 0; i2 < len; i2++)
			chk = bech32Polymod2(chk) ^ (prefix.charCodeAt(i2) & 31);
		for (const v of words) chk = bech32Polymod2(chk) ^ v;
		for (let i2 = 0; i2 < 6; i2++) chk = bech32Polymod2(chk);
		chk ^= encodingConst;
		return BECH_ALPHABET2.encode(convertRadix22([chk % 2 ** 30], 30, 5, false));
	}
	function genBech322(encoding) {
		const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
		const _words = radix22(5);
		const fromWords = _words.decode;
		const toWords = _words.encode;
		const fromWordsUnsafe = unsafeWrapper2(fromWords);
		function encode(prefix, words, limit2 = 90) {
			if (typeof prefix !== "string")
				throw new Error(
					`bech32.encode prefix should be string, not ${typeof prefix}`,
				);
			if (
				!Array.isArray(words) ||
				(words.length && typeof words[0] !== "number")
			)
				throw new Error(
					`bech32.encode words should be array of numbers, not ${typeof words}`,
				);
			const actualLength = prefix.length + 7 + words.length;
			if (limit2 !== false && actualLength > limit2)
				throw new TypeError(`Length ${actualLength} exceeds limit ${limit2}`);
			prefix = prefix.toLowerCase();
			return `${prefix}1${BECH_ALPHABET2.encode(words)}${bechChecksum2(prefix, words, ENCODING_CONST)}`;
		}
		function decode2(str, limit2 = 90) {
			if (typeof str !== "string")
				throw new Error(
					`bech32.decode input should be string, not ${typeof str}`,
				);
			if (str.length < 8 || (limit2 !== false && str.length > limit2))
				throw new TypeError(
					`Wrong string length: ${str.length} (${str}). Expected (8..${limit2})`,
				);
			const lowered = str.toLowerCase();
			if (str !== lowered && str !== str.toUpperCase())
				throw new Error(`String must be lowercase or uppercase`);
			str = lowered;
			const sepIndex = str.lastIndexOf("1");
			if (sepIndex === 0 || sepIndex === -1)
				throw new Error(
					`Letter "1" must be present between prefix and data only`,
				);
			const prefix = str.slice(0, sepIndex);
			const _words2 = str.slice(sepIndex + 1);
			if (_words2.length < 6)
				throw new Error("Data must be at least 6 characters long");
			const words = BECH_ALPHABET2.decode(_words2).slice(0, -6);
			const sum = bechChecksum2(prefix, words, ENCODING_CONST);
			if (!_words2.endsWith(sum))
				throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
			return { prefix, words };
		}
		const decodeUnsafe = unsafeWrapper2(decode2);
		function decodeToBytes(str) {
			const { prefix, words } = decode2(str, false);
			return { prefix, words, bytes: fromWords(words) };
		}
		return {
			encode,
			decode: decode2,
			decodeToBytes,
			decodeUnsafe,
			fromWords,
			fromWordsUnsafe,
			toWords,
		};
	}
	exports.bech32 = genBech322("bech32");
	exports.bech32m = genBech322("bech32m");
	exports.utf8 = {
		encode: (data) => new TextDecoder().decode(data),
		decode: (str) => new TextEncoder().encode(str),
	};
	exports.hex = chain2(
		radix22(4),
		alphabet2("0123456789abcdef"),
		join2(""),
		normalize2((s) => {
			if (typeof s !== "string" || s.length % 2)
				throw new TypeError(
					`hex.decode: expected string, got ${typeof s} with length ${s.length}`,
				);
			return s.toLowerCase();
		}),
	);
	var CODERS2 = {
		utf8: exports.utf8,
		hex: exports.hex,
		base16: exports.base16,
		base32: exports.base32,
		base64: exports.base64,
		base64url: exports.base64url,
		base58: exports.base58,
		base58xmr: exports.base58xmr,
	};
	var coderTypeError2 = `Invalid encoding type. Available types: ${Object.keys(CODERS2).join(", ")}`;
	var bytesToString = (type, bytes4) => {
		if (typeof type !== "string" || !CODERS2.hasOwnProperty(type))
			throw new TypeError(coderTypeError2);
		if (!(bytes4 instanceof Uint8Array))
			throw new TypeError("bytesToString() expects Uint8Array");
		return CODERS2[type].encode(bytes4);
	};
	exports.bytesToString = bytesToString;
	exports.str = exports.bytesToString;
	var stringToBytes = (type, str) => {
		if (!CODERS2.hasOwnProperty(type)) throw new TypeError(coderTypeError2);
		if (typeof str !== "string")
			throw new TypeError("stringToBytes() expects string");
		return CODERS2[type].decode(str);
	};
	exports.stringToBytes = stringToBytes;
	exports.bytes = exports.stringToBytes;
});

// node_modules/light-bolt11-decoder/bolt11.js
var require_bolt11 = __commonJS((exports, module) => {
	var { bech32: bech322, hex: hex2, utf8: utf82 } = require_lib2();
	var DEFAULTNETWORK = {
		bech32: "bc",
		pubKeyHash: 0,
		scriptHash: 5,
		validWitnessVersions: [0],
	};
	var TESTNETWORK = {
		bech32: "tb",
		pubKeyHash: 111,
		scriptHash: 196,
		validWitnessVersions: [0],
	};
	var SIGNETNETWORK = {
		bech32: "tbs",
		pubKeyHash: 111,
		scriptHash: 196,
		validWitnessVersions: [0],
	};
	var REGTESTNETWORK = {
		bech32: "bcrt",
		pubKeyHash: 111,
		scriptHash: 196,
		validWitnessVersions: [0],
	};
	var SIMNETWORK = {
		bech32: "sb",
		pubKeyHash: 63,
		scriptHash: 123,
		validWitnessVersions: [0],
	};
	var FEATUREBIT_ORDER = [
		"option_data_loss_protect",
		"initial_routing_sync",
		"option_upfront_shutdown_script",
		"gossip_queries",
		"var_onion_optin",
		"gossip_queries_ex",
		"option_static_remotekey",
		"payment_secret",
		"basic_mpp",
		"option_support_large_channel",
	];
	var DIVISORS = {
		m: BigInt(1000),
		u: BigInt(1e6),
		n: BigInt(1e9),
		p: BigInt(1000000000000),
	};
	var MAX_MILLISATS = BigInt("2100000000000000000");
	var MILLISATS_PER_BTC = BigInt(100000000000);
	var TAGCODES = {
		payment_hash: 1,
		payment_secret: 16,
		description: 13,
		payee: 19,
		description_hash: 23,
		expiry: 6,
		min_final_cltv_expiry: 24,
		fallback_address: 9,
		route_hint: 3,
		feature_bits: 5,
		metadata: 27,
	};
	var TAGNAMES = {};
	for (let i2 = 0, keys = Object.keys(TAGCODES); i2 < keys.length; i2++) {
		const currentName = keys[i2];
		const currentCode = TAGCODES[keys[i2]].toString();
		TAGNAMES[currentCode] = currentName;
	}
	var TAGPARSERS = {
		1: (words) => hex2.encode(bech322.fromWordsUnsafe(words)),
		16: (words) => hex2.encode(bech322.fromWordsUnsafe(words)),
		13: (words) => utf82.encode(bech322.fromWordsUnsafe(words)),
		19: (words) => hex2.encode(bech322.fromWordsUnsafe(words)),
		23: (words) => hex2.encode(bech322.fromWordsUnsafe(words)),
		27: (words) => hex2.encode(bech322.fromWordsUnsafe(words)),
		6: wordsToIntBE,
		24: wordsToIntBE,
		3: routingInfoParser,
		5: featureBitsParser,
	};
	function getUnknownParser(tagCode) {
		return (words) => ({
			tagCode: Number.parseInt(tagCode),
			words: bech322.encode("unknown", words, Number.MAX_SAFE_INTEGER),
		});
	}
	function wordsToIntBE(words) {
		return words.reverse().reduce((total, item, index) => {
			return total + item * Math.pow(32, index);
		}, 0);
	}
	function routingInfoParser(words) {
		const routes = [];
		let pubkey,
			shortChannelId,
			feeBaseMSats,
			feeProportionalMillionths,
			cltvExpiryDelta;
		let routesBuffer = bech322.fromWordsUnsafe(words);
		while (routesBuffer.length > 0) {
			pubkey = hex2.encode(routesBuffer.slice(0, 33));
			shortChannelId = hex2.encode(routesBuffer.slice(33, 41));
			feeBaseMSats = Number.parseInt(
				hex2.encode(routesBuffer.slice(41, 45)),
				16,
			);
			feeProportionalMillionths = Number.parseInt(
				hex2.encode(routesBuffer.slice(45, 49)),
				16,
			);
			cltvExpiryDelta = Number.parseInt(
				hex2.encode(routesBuffer.slice(49, 51)),
				16,
			);
			routesBuffer = routesBuffer.slice(51);
			routes.push({
				pubkey,
				short_channel_id: shortChannelId,
				fee_base_msat: feeBaseMSats,
				fee_proportional_millionths: feeProportionalMillionths,
				cltv_expiry_delta: cltvExpiryDelta,
			});
		}
		return routes;
	}
	function featureBitsParser(words) {
		const bools = words
			.slice()
			.reverse()
			.map((word) => [
				!!(word & 1),
				!!(word & 2),
				!!(word & 4),
				!!(word & 8),
				!!(word & 16),
			])
			.reduce((finalArr, itemArr) => finalArr.concat(itemArr), []);
		while (bools.length < FEATUREBIT_ORDER.length * 2) {
			bools.push(false);
		}
		const featureBits = {};
		FEATUREBIT_ORDER.forEach((featureName, index) => {
			let status;
			if (bools[index * 2]) {
				status = "required";
			} else if (bools[index * 2 + 1]) {
				status = "supported";
			} else {
				status = "unsupported";
			}
			featureBits[featureName] = status;
		});
		const extraBits = bools.slice(FEATUREBIT_ORDER.length * 2);
		featureBits.extra_bits = {
			start_bit: FEATUREBIT_ORDER.length * 2,
			bits: extraBits,
			has_required: extraBits.reduce(
				(result, bit, index) =>
					index % 2 !== 0 ? result || false : result || bit,
				false,
			),
		};
		return featureBits;
	}
	function hrpToMillisat(hrpString, outputString) {
		let divisor, value;
		if (hrpString.slice(-1).match(/^[munp]$/)) {
			divisor = hrpString.slice(-1);
			value = hrpString.slice(0, -1);
		} else if (hrpString.slice(-1).match(/^[^munp0-9]$/)) {
			throw new Error("Not a valid multiplier for the amount");
		} else {
			value = hrpString;
		}
		if (!value.match(/^\d+$/))
			throw new Error("Not a valid human readable amount");
		const valueBN = BigInt(value);
		const millisatoshisBN = divisor
			? (valueBN * MILLISATS_PER_BTC) / DIVISORS[divisor]
			: valueBN * MILLISATS_PER_BTC;
		if (
			(divisor === "p" && !(valueBN % BigInt(10) === BigInt(0))) ||
			millisatoshisBN > MAX_MILLISATS
		) {
			throw new Error("Amount is outside of valid range");
		}
		return outputString ? millisatoshisBN.toString() : millisatoshisBN;
	}
	function decode2(paymentRequest, network) {
		if (typeof paymentRequest !== "string")
			throw new Error("Lightning Payment Request must be string");
		if (paymentRequest.slice(0, 2).toLowerCase() !== "ln")
			throw new Error("Not a proper lightning payment request");
		const sections = [];
		const decoded = bech322.decode(paymentRequest, Number.MAX_SAFE_INTEGER);
		paymentRequest = paymentRequest.toLowerCase();
		const prefix = decoded.prefix;
		let words = decoded.words;
		let letters = paymentRequest.slice(prefix.length + 1);
		const sigWords = words.slice(-104);
		words = words.slice(0, -104);
		let prefixMatches = prefix.match(/^ln(\S+?)(\d*)([a-zA-Z]?)$/);
		if (prefixMatches && !prefixMatches[2])
			prefixMatches = prefix.match(/^ln(\S+)$/);
		if (!prefixMatches) {
			throw new Error("Not a proper lightning payment request");
		}
		sections.push({
			name: "lightning_network",
			letters: "ln",
		});
		const bech32Prefix = prefixMatches[1];
		let coinNetwork;
		if (!network) {
			switch (bech32Prefix) {
				case DEFAULTNETWORK.bech32:
					coinNetwork = DEFAULTNETWORK;
					break;
				case TESTNETWORK.bech32:
					coinNetwork = TESTNETWORK;
					break;
				case SIGNETNETWORK.bech32:
					coinNetwork = SIGNETNETWORK;
					break;
				case REGTESTNETWORK.bech32:
					coinNetwork = REGTESTNETWORK;
					break;
				case SIMNETWORK.bech32:
					coinNetwork = SIMNETWORK;
					break;
			}
		} else {
			if (
				network.bech32 === undefined ||
				network.pubKeyHash === undefined ||
				network.scriptHash === undefined ||
				!Array.isArray(network.validWitnessVersions)
			)
				throw new Error("Invalid network");
			coinNetwork = network;
		}
		if (!coinNetwork || coinNetwork.bech32 !== bech32Prefix) {
			throw new Error("Unknown coin bech32 prefix");
		}
		sections.push({
			name: "coin_network",
			letters: bech32Prefix,
			value: coinNetwork,
		});
		const value = prefixMatches[2];
		let millisatoshis;
		if (value) {
			const divisor = prefixMatches[3];
			millisatoshis = hrpToMillisat(value + divisor, true);
			sections.push({
				name: "amount",
				letters: prefixMatches[2] + prefixMatches[3],
				value: millisatoshis,
			});
		} else {
			millisatoshis = null;
		}
		sections.push({
			name: "separator",
			letters: "1",
		});
		const timestamp = wordsToIntBE(words.slice(0, 7));
		words = words.slice(7);
		sections.push({
			name: "timestamp",
			letters: letters.slice(0, 7),
			value: timestamp,
		});
		letters = letters.slice(7);
		let tagName, parser, tagLength, tagWords;
		while (words.length > 0) {
			const tagCode = words[0].toString();
			tagName = TAGNAMES[tagCode] || "unknown_tag";
			parser = TAGPARSERS[tagCode] || getUnknownParser(tagCode);
			words = words.slice(1);
			tagLength = wordsToIntBE(words.slice(0, 2));
			words = words.slice(2);
			tagWords = words.slice(0, tagLength);
			words = words.slice(tagLength);
			sections.push({
				name: tagName,
				tag: letters[0],
				letters: letters.slice(0, 1 + 2 + tagLength),
				value: parser(tagWords),
			});
			letters = letters.slice(1 + 2 + tagLength);
		}
		sections.push({
			name: "signature",
			letters: letters.slice(0, 104),
			value: hex2.encode(bech322.fromWordsUnsafe(sigWords)),
		});
		letters = letters.slice(104);
		sections.push({
			name: "checksum",
			letters,
		});
		const result = {
			paymentRequest,
			sections,
			get expiry() {
				const exp = sections.find((s) => s.name === "expiry");
				if (exp) return getValue("timestamp") + exp.value;
			},
			get route_hints() {
				return sections
					.filter((s) => s.name === "route_hint")
					.map((s) => s.value);
			},
		};
		for (const name in TAGCODES) {
			if (name === "route_hint") {
				continue;
			}
			Object.defineProperty(result, name, {
				get() {
					return getValue(name);
				},
			});
		}
		return result;
		function getValue(name) {
			const section = sections.find((s) => s.name === name);
			return section ? section.value : undefined;
		}
	}
	module.exports = {
		decode: decode2,
		hrpToMillisat,
	};
});

// node_modules/@nostr-dev-kit/ndk/dist/index.mjs
var import_tseep = __toESM(require_lib(), 1);
var import_debug = __toESM(require_src(), 1);
var import_debug2 = __toESM(require_src(), 1);
var import_tseep2 = __toESM(require_lib(), 1);
var import_debug3 = __toESM(require_src(), 1);

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/_assert.js
function number(n) {
	if (!Number.isSafeInteger(n) || n < 0)
		throw new Error(`Wrong positive integer: ${n}`);
}
function bytes(b, ...lengths) {
	if (!(b instanceof Uint8Array)) throw new Error("Expected Uint8Array");
	if (lengths.length > 0 && !lengths.includes(b.length))
		throw new Error(
			`Expected Uint8Array of length ${lengths}, not of length=${b.length}`,
		);
}
function hash(hash2) {
	if (typeof hash2 !== "function" || typeof hash2.create !== "function")
		throw new Error("Hash should be wrapped by utils.wrapConstructor");
	number(hash2.outputLen);
	number(hash2.blockLen);
}
function exists(instance, checkFinished = true) {
	if (instance.destroyed) throw new Error("Hash instance has been destroyed");
	if (checkFinished && instance.finished)
		throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
	bytes(out);
	const min = instance.outputLen;
	if (out.length < min) {
		throw new Error(
			`digestInto() expects output buffer of length at least ${min}`,
		);
	}
}

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/cryptoNode.js
import * as nc from "node:crypto";
var crypto =
	nc && typeof nc === "object" && "webcrypto" in nc ? nc.webcrypto : undefined;

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/utils.js
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var u8a = (a) => a instanceof Uint8Array;
var createView = (arr) =>
	new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
var rotr = (word, shift) => (word << (32 - shift)) | (word >>> shift);
var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE) throw new Error("Non little-endian hardware is not supported");
function utf8ToBytes(str) {
	if (typeof str !== "string")
		throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
	return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
	if (typeof data === "string") data = utf8ToBytes(data);
	if (!u8a(data)) throw new Error(`expected Uint8Array, got ${typeof data}`);
	return data;
}
function concatBytes(...arrays) {
	const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
	let pad = 0;
	arrays.forEach((a) => {
		if (!u8a(a)) throw new Error("Uint8Array expected");
		r.set(a, pad);
		pad += a.length;
	});
	return r;
}

class Hash {
	clone() {
		return this._cloneInto();
	}
}
var toStr = {}.toString;
function wrapConstructor(hashCons) {
	const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
	const tmp = hashCons();
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = () => hashCons();
	return hashC;
}
function randomBytes(bytesLength = 32) {
	if (crypto && typeof crypto.getRandomValues === "function") {
		return crypto.getRandomValues(new Uint8Array(bytesLength));
	}
	throw new Error("crypto.getRandomValues must be defined");
}

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/_sha2.js
function setBigUint64(view, byteOffset, value, isLE2) {
	if (typeof view.setBigUint64 === "function")
		return view.setBigUint64(byteOffset, value, isLE2);
	const _32n = BigInt(32);
	const _u32_max = BigInt(4294967295);
	const wh = Number((value >> _32n) & _u32_max);
	const wl = Number(value & _u32_max);
	const h = isLE2 ? 4 : 0;
	const l = isLE2 ? 0 : 4;
	view.setUint32(byteOffset + h, wh, isLE2);
	view.setUint32(byteOffset + l, wl, isLE2);
}

class SHA2 extends Hash {
	constructor(blockLen, outputLen, padOffset, isLE2) {
		super();
		this.blockLen = blockLen;
		this.outputLen = outputLen;
		this.padOffset = padOffset;
		this.isLE = isLE2;
		this.finished = false;
		this.length = 0;
		this.pos = 0;
		this.destroyed = false;
		this.buffer = new Uint8Array(blockLen);
		this.view = createView(this.buffer);
	}
	update(data) {
		exists(this);
		const { view, buffer, blockLen } = this;
		data = toBytes(data);
		const len = data.length;
		for (let pos = 0; pos < len; ) {
			const take = Math.min(blockLen - this.pos, len - pos);
			if (take === blockLen) {
				const dataView = createView(data);
				for (; blockLen <= len - pos; pos += blockLen)
					this.process(dataView, pos);
				continue;
			}
			buffer.set(data.subarray(pos, pos + take), this.pos);
			this.pos += take;
			pos += take;
			if (this.pos === blockLen) {
				this.process(view, 0);
				this.pos = 0;
			}
		}
		this.length += data.length;
		this.roundClean();
		return this;
	}
	digestInto(out) {
		exists(this);
		output(out, this);
		this.finished = true;
		const { buffer, view, blockLen, isLE: isLE2 } = this;
		let { pos } = this;
		buffer[pos++] = 128;
		this.buffer.subarray(pos).fill(0);
		if (this.padOffset > blockLen - pos) {
			this.process(view, 0);
			pos = 0;
		}
		for (let i = pos; i < blockLen; i++) buffer[i] = 0;
		setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
		this.process(view, 0);
		const oview = createView(out);
		const len = this.outputLen;
		if (len % 4) throw new Error("_sha2: outputLen should be aligned to 32bit");
		const outLen = len / 4;
		const state = this.get();
		if (outLen > state.length)
			throw new Error("_sha2: outputLen bigger than state");
		for (let i = 0; i < outLen; i++) oview.setUint32(4 * i, state[i], isLE2);
	}
	digest() {
		const { buffer, outputLen } = this;
		this.digestInto(buffer);
		const res = buffer.slice(0, outputLen);
		this.destroy();
		return res;
	}
	_cloneInto(to) {
		to || (to = new this.constructor());
		to.set(...this.get());
		const { blockLen, buffer, length, finished, destroyed, pos } = this;
		to.length = length;
		to.pos = pos;
		to.finished = finished;
		to.destroyed = destroyed;
		if (length % blockLen) to.buffer.set(buffer);
		return to;
	}
}

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/sha256.js
var Chi = (a, b, c) => (a & b) ^ (~a & c);
var Maj = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
var SHA256_K = /* @__PURE__ */ new Uint32Array([
	1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
	2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
	1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
	264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
	2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
	113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
	1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
	3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
	430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063,
	1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474,
	2756734187, 3204031479, 3329325298,
]);
var IV = /* @__PURE__ */ new Uint32Array([
	1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
	528734635, 1541459225,
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);

class SHA256 extends SHA2 {
	constructor() {
		super(64, 32, 8, false);
		this.A = IV[0] | 0;
		this.B = IV[1] | 0;
		this.C = IV[2] | 0;
		this.D = IV[3] | 0;
		this.E = IV[4] | 0;
		this.F = IV[5] | 0;
		this.G = IV[6] | 0;
		this.H = IV[7] | 0;
	}
	get() {
		const { A, B, C, D, E, F, G, H } = this;
		return [A, B, C, D, E, F, G, H];
	}
	set(A, B, C, D, E, F, G, H) {
		this.A = A | 0;
		this.B = B | 0;
		this.C = C | 0;
		this.D = D | 0;
		this.E = E | 0;
		this.F = F | 0;
		this.G = G | 0;
		this.H = H | 0;
	}
	process(view, offset) {
		for (let i = 0; i < 16; i++, offset += 4)
			SHA256_W[i] = view.getUint32(offset, false);
		for (let i = 16; i < 64; i++) {
			const W15 = SHA256_W[i - 15];
			const W2 = SHA256_W[i - 2];
			const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
			const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
			SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
		}
		let { A, B, C, D, E, F, G, H } = this;
		for (let i = 0; i < 64; i++) {
			const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
			const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
			const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
			const T2 = (sigma0 + Maj(A, B, C)) | 0;
			H = G;
			G = F;
			F = E;
			E = (D + T1) | 0;
			D = C;
			C = B;
			B = A;
			A = (T1 + T2) | 0;
		}
		A = (A + this.A) | 0;
		B = (B + this.B) | 0;
		C = (C + this.C) | 0;
		D = (D + this.D) | 0;
		E = (E + this.E) | 0;
		F = (F + this.F) | 0;
		G = (G + this.G) | 0;
		H = (H + this.H) | 0;
		this.set(A, B, C, D, E, F, G, H);
	}
	roundClean() {
		SHA256_W.fill(0);
	}
	destroy() {
		this.set(0, 0, 0, 0, 0, 0, 0, 0);
		this.buffer.fill(0);
	}
}
var sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA256());

// node_modules/nostr-tools/node_modules/@noble/curves/esm/abstract/utils.js
var exports_utils = {};
__export(exports_utils, {
	validateObject: () => validateObject,
	utf8ToBytes: () => utf8ToBytes2,
	numberToVarBytesBE: () => numberToVarBytesBE,
	numberToHexUnpadded: () => numberToHexUnpadded,
	numberToBytesLE: () => numberToBytesLE,
	numberToBytesBE: () => numberToBytesBE,
	hexToNumber: () => hexToNumber,
	hexToBytes: () => hexToBytes,
	equalBytes: () => equalBytes,
	ensureBytes: () => ensureBytes,
	createHmacDrbg: () => createHmacDrbg,
	concatBytes: () => concatBytes2,
	bytesToNumberLE: () => bytesToNumberLE,
	bytesToNumberBE: () => bytesToNumberBE,
	bytesToHex: () => bytesToHex,
	bitSet: () => bitSet,
	bitMask: () => bitMask,
	bitLen: () => bitLen,
	bitGet: () => bitGet,
});
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var u8a2 = (a) => a instanceof Uint8Array;
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) =>
	i.toString(16).padStart(2, "0"),
);
function bytesToHex(bytes2) {
	if (!u8a2(bytes2)) throw new Error("Uint8Array expected");
	let hex = "";
	for (let i = 0; i < bytes2.length; i++) {
		hex += hexes[bytes2[i]];
	}
	return hex;
}
function numberToHexUnpadded(num) {
	const hex = num.toString(16);
	return hex.length & 1 ? `0${hex}` : hex;
}
function hexToNumber(hex) {
	if (typeof hex !== "string")
		throw new Error("hex string expected, got " + typeof hex);
	return BigInt(hex === "" ? "0" : `0x${hex}`);
}
function hexToBytes(hex) {
	if (typeof hex !== "string")
		throw new Error("hex string expected, got " + typeof hex);
	const len = hex.length;
	if (len % 2)
		throw new Error(
			"padded hex string expected, got unpadded hex of length " + len,
		);
	const array = new Uint8Array(len / 2);
	for (let i = 0; i < array.length; i++) {
		const j = i * 2;
		const hexByte = hex.slice(j, j + 2);
		const byte = Number.parseInt(hexByte, 16);
		if (Number.isNaN(byte) || byte < 0)
			throw new Error("Invalid byte sequence");
		array[i] = byte;
	}
	return array;
}
function bytesToNumberBE(bytes2) {
	return hexToNumber(bytesToHex(bytes2));
}
function bytesToNumberLE(bytes2) {
	if (!u8a2(bytes2)) throw new Error("Uint8Array expected");
	return hexToNumber(bytesToHex(Uint8Array.from(bytes2).reverse()));
}
function numberToBytesBE(n, len) {
	return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
	return numberToBytesBE(n, len).reverse();
}
function numberToVarBytesBE(n) {
	return hexToBytes(numberToHexUnpadded(n));
}
function ensureBytes(title, hex, expectedLength) {
	let res;
	if (typeof hex === "string") {
		try {
			res = hexToBytes(hex);
		} catch (e) {
			throw new Error(
				`${title} must be valid hex string, got "${hex}". Cause: ${e}`,
			);
		}
	} else if (u8a2(hex)) {
		res = Uint8Array.from(hex);
	} else {
		throw new Error(`${title} must be hex string or Uint8Array`);
	}
	const len = res.length;
	if (typeof expectedLength === "number" && len !== expectedLength)
		throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
	return res;
}
function concatBytes2(...arrays) {
	const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
	let pad = 0;
	arrays.forEach((a) => {
		if (!u8a2(a)) throw new Error("Uint8Array expected");
		r.set(a, pad);
		pad += a.length;
	});
	return r;
}
function equalBytes(b1, b2) {
	if (b1.length !== b2.length) return false;
	for (let i = 0; i < b1.length; i++) if (b1[i] !== b2[i]) return false;
	return true;
}
function utf8ToBytes2(str) {
	if (typeof str !== "string")
		throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
	return new Uint8Array(new TextEncoder().encode(str));
}
function bitLen(n) {
	let len;
	for (len = 0; n > _0n; n >>= _1n, len += 1);
	return len;
}
function bitGet(n, pos) {
	return (n >> BigInt(pos)) & _1n;
}
var bitSet = (n, pos, value) => {
	return n | ((value ? _1n : _0n) << BigInt(pos));
};
var bitMask = (n) => (_2n << BigInt(n - 1)) - _1n;
var u8n = (data) => new Uint8Array(data);
var u8fr = (arr) => Uint8Array.from(arr);
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
	if (typeof hashLen !== "number" || hashLen < 2)
		throw new Error("hashLen must be a number");
	if (typeof qByteLen !== "number" || qByteLen < 2)
		throw new Error("qByteLen must be a number");
	if (typeof hmacFn !== "function")
		throw new Error("hmacFn must be a function");
	let v = u8n(hashLen);
	let k = u8n(hashLen);
	let i = 0;
	const reset = () => {
		v.fill(1);
		k.fill(0);
		i = 0;
	};
	const h = (...b) => hmacFn(k, v, ...b);
	const reseed = (seed = u8n()) => {
		k = h(u8fr([0]), seed);
		v = h();
		if (seed.length === 0) return;
		k = h(u8fr([1]), seed);
		v = h();
	};
	const gen = () => {
		if (i++ >= 1000) throw new Error("drbg: tried 1000 values");
		let len = 0;
		const out = [];
		while (len < qByteLen) {
			v = h();
			const sl = v.slice();
			out.push(sl);
			len += v.length;
		}
		return concatBytes2(...out);
	};
	const genUntil = (seed, pred) => {
		reset();
		reseed(seed);
		let res = undefined;
		while (!(res = pred(gen()))) reseed();
		reset();
		return res;
	};
	return genUntil;
}
var validatorFns = {
	bigint: (val) => typeof val === "bigint",
	function: (val) => typeof val === "function",
	boolean: (val) => typeof val === "boolean",
	string: (val) => typeof val === "string",
	stringOrUint8Array: (val) =>
		typeof val === "string" || val instanceof Uint8Array,
	isSafeInteger: (val) => Number.isSafeInteger(val),
	array: (val) => Array.isArray(val),
	field: (val, object) => object.Fp.isValid(val),
	hash: (val) =>
		typeof val === "function" && Number.isSafeInteger(val.outputLen),
};
function validateObject(object, validators, optValidators = {}) {
	const checkField = (fieldName, type, isOptional) => {
		const checkVal = validatorFns[type];
		if (typeof checkVal !== "function")
			throw new Error(`Invalid validator "${type}", expected function`);
		const val = object[fieldName];
		if (isOptional && val === undefined) return;
		if (!checkVal(val, object)) {
			throw new Error(
				`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`,
			);
		}
	};
	for (const [fieldName, type] of Object.entries(validators))
		checkField(fieldName, type, false);
	for (const [fieldName, type] of Object.entries(optValidators))
		checkField(fieldName, type, true);
	return object;
}

// node_modules/nostr-tools/node_modules/@noble/curves/esm/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n2 = BigInt(2);
var _3n = BigInt(3);
var _4n = BigInt(4);
var _5n = BigInt(5);
var _8n = BigInt(8);
var _9n = BigInt(9);
var _16n = BigInt(16);
function mod(a, b) {
	const result = a % b;
	return result >= _0n2 ? result : b + result;
}
function pow(num, power, modulo) {
	if (modulo <= _0n2 || power < _0n2)
		throw new Error("Expected power/modulo > 0");
	if (modulo === _1n2) return _0n2;
	let res = _1n2;
	while (power > _0n2) {
		if (power & _1n2) res = (res * num) % modulo;
		num = (num * num) % modulo;
		power >>= _1n2;
	}
	return res;
}
function pow2(x, power, modulo) {
	let res = x;
	while (power-- > _0n2) {
		res *= res;
		res %= modulo;
	}
	return res;
}
function invert(number2, modulo) {
	if (number2 === _0n2 || modulo <= _0n2) {
		throw new Error(
			`invert: expected positive integers, got n=${number2} mod=${modulo}`,
		);
	}
	let a = mod(number2, modulo);
	let b = modulo;
	let x = _0n2,
		y = _1n2,
		u = _1n2,
		v = _0n2;
	while (a !== _0n2) {
		const q = b / a;
		const r = b % a;
		const m = x - u * q;
		const n = y - v * q;
		(b = a), (a = r), (x = u), (y = v), (u = m), (v = n);
	}
	const gcd = b;
	if (gcd !== _1n2) throw new Error("invert: does not exist");
	return mod(x, modulo);
}
function tonelliShanks(P) {
	const legendreC = (P - _1n2) / _2n2;
	let Q, S, Z;
	for (Q = P - _1n2, S = 0; Q % _2n2 === _0n2; Q /= _2n2, S++);
	for (Z = _2n2; Z < P && pow(Z, legendreC, P) !== P - _1n2; Z++);
	if (S === 1) {
		const p1div4 = (P + _1n2) / _4n;
		return function tonelliFast(Fp, n) {
			const root = Fp.pow(n, p1div4);
			if (!Fp.eql(Fp.sqr(root), n)) throw new Error("Cannot find square root");
			return root;
		};
	}
	const Q1div2 = (Q + _1n2) / _2n2;
	return function tonelliSlow(Fp, n) {
		if (Fp.pow(n, legendreC) === Fp.neg(Fp.ONE))
			throw new Error("Cannot find square root");
		let r = S;
		let g = Fp.pow(Fp.mul(Fp.ONE, Z), Q);
		let x = Fp.pow(n, Q1div2);
		let b = Fp.pow(n, Q);
		while (!Fp.eql(b, Fp.ONE)) {
			if (Fp.eql(b, Fp.ZERO)) return Fp.ZERO;
			let m = 1;
			for (let t2 = Fp.sqr(b); m < r; m++) {
				if (Fp.eql(t2, Fp.ONE)) break;
				t2 = Fp.sqr(t2);
			}
			const ge = Fp.pow(g, _1n2 << BigInt(r - m - 1));
			g = Fp.sqr(ge);
			x = Fp.mul(x, ge);
			b = Fp.mul(b, g);
			r = m;
		}
		return x;
	};
}
function FpSqrt(P) {
	if (P % _4n === _3n) {
		const p1div4 = (P + _1n2) / _4n;
		return function sqrt3mod4(Fp, n) {
			const root = Fp.pow(n, p1div4);
			if (!Fp.eql(Fp.sqr(root), n)) throw new Error("Cannot find square root");
			return root;
		};
	}
	if (P % _8n === _5n) {
		const c1 = (P - _5n) / _8n;
		return function sqrt5mod8(Fp, n) {
			const n2 = Fp.mul(n, _2n2);
			const v = Fp.pow(n2, c1);
			const nv = Fp.mul(n, v);
			const i = Fp.mul(Fp.mul(nv, _2n2), v);
			const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
			if (!Fp.eql(Fp.sqr(root), n)) throw new Error("Cannot find square root");
			return root;
		};
	}
	if (P % _16n === _9n) {
	}
	return tonelliShanks(P);
}
var FIELD_FIELDS = [
	"create",
	"isValid",
	"is0",
	"neg",
	"inv",
	"sqrt",
	"sqr",
	"eql",
	"add",
	"sub",
	"mul",
	"pow",
	"div",
	"addN",
	"subN",
	"mulN",
	"sqrN",
];
function validateField(field) {
	const initial = {
		ORDER: "bigint",
		MASK: "bigint",
		BYTES: "isSafeInteger",
		BITS: "isSafeInteger",
	};
	const opts = FIELD_FIELDS.reduce((map, val) => {
		map[val] = "function";
		return map;
	}, initial);
	return validateObject(field, opts);
}
function FpPow(f, num, power) {
	if (power < _0n2) throw new Error("Expected power > 0");
	if (power === _0n2) return f.ONE;
	if (power === _1n2) return num;
	let p = f.ONE;
	let d = num;
	while (power > _0n2) {
		if (power & _1n2) p = f.mul(p, d);
		d = f.sqr(d);
		power >>= _1n2;
	}
	return p;
}
function FpInvertBatch(f, nums) {
	const tmp = new Array(nums.length);
	const lastMultiplied = nums.reduce((acc, num, i) => {
		if (f.is0(num)) return acc;
		tmp[i] = acc;
		return f.mul(acc, num);
	}, f.ONE);
	const inverted = f.inv(lastMultiplied);
	nums.reduceRight((acc, num, i) => {
		if (f.is0(num)) return acc;
		tmp[i] = f.mul(acc, tmp[i]);
		return f.mul(acc, num);
	}, inverted);
	return tmp;
}
function nLength(n, nBitLength) {
	const _nBitLength =
		nBitLength !== undefined ? nBitLength : n.toString(2).length;
	const nByteLength = Math.ceil(_nBitLength / 8);
	return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLen2, isLE2 = false, redef = {}) {
	if (ORDER <= _0n2) throw new Error(`Expected Field ORDER > 0, got ${ORDER}`);
	const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen2);
	if (BYTES > 2048)
		throw new Error("Field lengths over 2048 bytes are not supported");
	const sqrtP = FpSqrt(ORDER);
	const f = Object.freeze({
		ORDER,
		BITS,
		BYTES,
		MASK: bitMask(BITS),
		ZERO: _0n2,
		ONE: _1n2,
		create: (num) => mod(num, ORDER),
		isValid: (num) => {
			if (typeof num !== "bigint")
				throw new Error(
					`Invalid field element: expected bigint, got ${typeof num}`,
				);
			return _0n2 <= num && num < ORDER;
		},
		is0: (num) => num === _0n2,
		isOdd: (num) => (num & _1n2) === _1n2,
		neg: (num) => mod(-num, ORDER),
		eql: (lhs, rhs) => lhs === rhs,
		sqr: (num) => mod(num * num, ORDER),
		add: (lhs, rhs) => mod(lhs + rhs, ORDER),
		sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
		mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
		pow: (num, power) => FpPow(f, num, power),
		div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
		sqrN: (num) => num * num,
		addN: (lhs, rhs) => lhs + rhs,
		subN: (lhs, rhs) => lhs - rhs,
		mulN: (lhs, rhs) => lhs * rhs,
		inv: (num) => invert(num, ORDER),
		sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
		invertBatch: (lst) => FpInvertBatch(f, lst),
		cmov: (a, b, c) => (c ? b : a),
		toBytes: (num) =>
			isLE2 ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
		fromBytes: (bytes2) => {
			if (bytes2.length !== BYTES)
				throw new Error(
					`Fp.fromBytes: expected ${BYTES}, got ${bytes2.length}`,
				);
			return isLE2 ? bytesToNumberLE(bytes2) : bytesToNumberBE(bytes2);
		},
	});
	return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
	if (typeof fieldOrder !== "bigint")
		throw new Error("field order must be bigint");
	const bitLength = fieldOrder.toString(2).length;
	return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
	const length = getFieldBytesLength(fieldOrder);
	return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
	const len = key.length;
	const fieldLen = getFieldBytesLength(fieldOrder);
	const minLen = getMinHashLength(fieldOrder);
	if (len < 16 || len < minLen || len > 1024)
		throw new Error(`expected ${minLen}-1024 bytes of input, got ${len}`);
	const num = isLE2 ? bytesToNumberBE(key) : bytesToNumberLE(key);
	const reduced = mod(num, fieldOrder - _1n2) + _1n2;
	return isLE2
		? numberToBytesLE(reduced, fieldLen)
		: numberToBytesBE(reduced, fieldLen);
}

// node_modules/nostr-tools/node_modules/@noble/curves/esm/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
function wNAF(c, bits) {
	const constTimeNegate = (condition, item) => {
		const neg = item.negate();
		return condition ? neg : item;
	};
	const opts = (W) => {
		const windows = Math.ceil(bits / W) + 1;
		const windowSize = 2 ** (W - 1);
		return { windows, windowSize };
	};
	return {
		constTimeNegate,
		unsafeLadder(elm, n) {
			let p = c.ZERO;
			let d = elm;
			while (n > _0n3) {
				if (n & _1n3) p = p.add(d);
				d = d.double();
				n >>= _1n3;
			}
			return p;
		},
		precomputeWindow(elm, W) {
			const { windows, windowSize } = opts(W);
			const points = [];
			let p = elm;
			let base = p;
			for (let window2 = 0; window2 < windows; window2++) {
				base = p;
				points.push(base);
				for (let i = 1; i < windowSize; i++) {
					base = base.add(p);
					points.push(base);
				}
				p = base.double();
			}
			return points;
		},
		wNAF(W, precomputes, n) {
			const { windows, windowSize } = opts(W);
			let p = c.ZERO;
			let f = c.BASE;
			const mask = BigInt(2 ** W - 1);
			const maxNumber = 2 ** W;
			const shiftBy = BigInt(W);
			for (let window2 = 0; window2 < windows; window2++) {
				const offset = window2 * windowSize;
				let wbits = Number(n & mask);
				n >>= shiftBy;
				if (wbits > windowSize) {
					wbits -= maxNumber;
					n += _1n3;
				}
				const offset1 = offset;
				const offset2 = offset + Math.abs(wbits) - 1;
				const cond1 = window2 % 2 !== 0;
				const cond2 = wbits < 0;
				if (wbits === 0) {
					f = f.add(constTimeNegate(cond1, precomputes[offset1]));
				} else {
					p = p.add(constTimeNegate(cond2, precomputes[offset2]));
				}
			}
			return { p, f };
		},
		wNAFCached(P, precomputesMap, n, transform) {
			const W = P._WINDOW_SIZE || 1;
			let comp = precomputesMap.get(P);
			if (!comp) {
				comp = this.precomputeWindow(P, W);
				if (W !== 1) {
					precomputesMap.set(P, transform(comp));
				}
			}
			return this.wNAF(W, comp, n);
		},
	};
}
function validateBasic(curve) {
	validateField(curve.Fp);
	validateObject(
		curve,
		{
			n: "bigint",
			h: "bigint",
			Gx: "field",
			Gy: "field",
		},
		{
			nBitLength: "isSafeInteger",
			nByteLength: "isSafeInteger",
		},
	);
	return Object.freeze({
		...nLength(curve.n, curve.nBitLength),
		...curve,
		...{ p: curve.Fp.ORDER },
	});
}

// node_modules/nostr-tools/node_modules/@noble/curves/esm/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function validatePointOpts(curve) {
	const opts = validateBasic(curve);
	validateObject(
		opts,
		{
			a: "field",
			b: "field",
		},
		{
			allowedPrivateKeyLengths: "array",
			wrapPrivateKey: "boolean",
			isTorsionFree: "function",
			clearCofactor: "function",
			allowInfinityPoint: "boolean",
			fromBytes: "function",
			toBytes: "function",
		},
	);
	const { endo, Fp, a } = opts;
	if (endo) {
		if (!Fp.eql(a, Fp.ZERO)) {
			throw new Error(
				"Endomorphism can only be defined for Koblitz curves that have a=0",
			);
		}
		if (
			typeof endo !== "object" ||
			typeof endo.beta !== "bigint" ||
			typeof endo.splitScalar !== "function"
		) {
			throw new Error(
				"Expected endomorphism with beta: bigint and splitScalar: function",
			);
		}
	}
	return Object.freeze({ ...opts });
}
var { bytesToNumberBE: b2n, hexToBytes: h2b } = exports_utils;
var DER = {
	Err: class DERErr extends Error {
		constructor(m = "") {
			super(m);
		}
	},
	_parseInt(data) {
		const { Err: E } = DER;
		if (data.length < 2 || data[0] !== 2)
			throw new E("Invalid signature integer tag");
		const len = data[1];
		const res = data.subarray(2, len + 2);
		if (!len || res.length !== len)
			throw new E("Invalid signature integer: wrong length");
		if (res[0] & 128) throw new E("Invalid signature integer: negative");
		if (res[0] === 0 && !(res[1] & 128))
			throw new E("Invalid signature integer: unnecessary leading zero");
		return { d: b2n(res), l: data.subarray(len + 2) };
	},
	toSig(hex) {
		const { Err: E } = DER;
		const data = typeof hex === "string" ? h2b(hex) : hex;
		if (!(data instanceof Uint8Array)) throw new Error("ui8a expected");
		const l = data.length;
		if (l < 2 || data[0] != 48) throw new E("Invalid signature tag");
		if (data[1] !== l - 2) throw new E("Invalid signature: incorrect length");
		const { d: r, l: sBytes } = DER._parseInt(data.subarray(2));
		const { d: s, l: rBytesLeft } = DER._parseInt(sBytes);
		if (rBytesLeft.length)
			throw new E("Invalid signature: left bytes after parsing");
		return { r, s };
	},
	hexFromSig(sig) {
		const slice = (s2) => (Number.parseInt(s2[0], 16) & 8 ? "00" + s2 : s2);
		const h = (num) => {
			const hex = num.toString(16);
			return hex.length & 1 ? `0${hex}` : hex;
		};
		const s = slice(h(sig.s));
		const r = slice(h(sig.r));
		const shl = s.length / 2;
		const rhl = r.length / 2;
		const sl = h(shl);
		const rl = h(rhl);
		return `30${h(rhl + shl + 4)}02${rl}${r}02${sl}${s}`;
	},
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n3 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function weierstrassPoints(opts) {
	const CURVE = validatePointOpts(opts);
	const { Fp } = CURVE;
	const toBytes2 =
		CURVE.toBytes ||
		((_c, point, _isCompressed) => {
			const a = point.toAffine();
			return concatBytes2(
				Uint8Array.from([4]),
				Fp.toBytes(a.x),
				Fp.toBytes(a.y),
			);
		});
	const fromBytes =
		CURVE.fromBytes ||
		((bytes2) => {
			const tail = bytes2.subarray(1);
			const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
			const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
			return { x, y };
		});
	function weierstrassEquation(x) {
		const { a, b } = CURVE;
		const x2 = Fp.sqr(x);
		const x3 = Fp.mul(x2, x);
		return Fp.add(Fp.add(x3, Fp.mul(x, a)), b);
	}
	if (!Fp.eql(Fp.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
		throw new Error("bad generator point: equation left != right");
	function isWithinCurveOrder(num) {
		return typeof num === "bigint" && _0n4 < num && num < CURVE.n;
	}
	function assertGE(num) {
		if (!isWithinCurveOrder(num))
			throw new Error("Expected valid bigint: 0 < bigint < curve.n");
	}
	function normPrivateKeyToScalar(key) {
		const {
			allowedPrivateKeyLengths: lengths,
			nByteLength,
			wrapPrivateKey,
			n,
		} = CURVE;
		if (lengths && typeof key !== "bigint") {
			if (key instanceof Uint8Array) key = bytesToHex(key);
			if (typeof key !== "string" || !lengths.includes(key.length))
				throw new Error("Invalid key");
			key = key.padStart(nByteLength * 2, "0");
		}
		let num;
		try {
			num =
				typeof key === "bigint"
					? key
					: bytesToNumberBE(ensureBytes("private key", key, nByteLength));
		} catch (error) {
			throw new Error(
				`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`,
			);
		}
		if (wrapPrivateKey) num = mod(num, n);
		assertGE(num);
		return num;
	}
	const pointPrecomputes = new Map();
	function assertPrjPoint(other) {
		if (!(other instanceof Point)) throw new Error("ProjectivePoint expected");
	}

	class Point {
		constructor(px, py, pz) {
			this.px = px;
			this.py = py;
			this.pz = pz;
			if (px == null || !Fp.isValid(px)) throw new Error("x required");
			if (py == null || !Fp.isValid(py)) throw new Error("y required");
			if (pz == null || !Fp.isValid(pz)) throw new Error("z required");
		}
		static fromAffine(p) {
			const { x, y } = p || {};
			if (!p || !Fp.isValid(x) || !Fp.isValid(y))
				throw new Error("invalid affine point");
			if (p instanceof Point) throw new Error("projective point not allowed");
			const is0 = (i) => Fp.eql(i, Fp.ZERO);
			if (is0(x) && is0(y)) return Point.ZERO;
			return new Point(x, y, Fp.ONE);
		}
		get x() {
			return this.toAffine().x;
		}
		get y() {
			return this.toAffine().y;
		}
		static normalizeZ(points) {
			const toInv = Fp.invertBatch(points.map((p) => p.pz));
			return points.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
		}
		static fromHex(hex) {
			const P = Point.fromAffine(fromBytes(ensureBytes("pointHex", hex)));
			P.assertValidity();
			return P;
		}
		static fromPrivateKey(privateKey) {
			return Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
		}
		_setWindowSize(windowSize) {
			this._WINDOW_SIZE = windowSize;
			pointPrecomputes.delete(this);
		}
		assertValidity() {
			if (this.is0()) {
				if (CURVE.allowInfinityPoint && !Fp.is0(this.py)) return;
				throw new Error("bad point: ZERO");
			}
			const { x, y } = this.toAffine();
			if (!Fp.isValid(x) || !Fp.isValid(y))
				throw new Error("bad point: x or y not FE");
			const left = Fp.sqr(y);
			const right = weierstrassEquation(x);
			if (!Fp.eql(left, right))
				throw new Error("bad point: equation left != right");
			if (!this.isTorsionFree())
				throw new Error("bad point: not in prime-order subgroup");
		}
		hasEvenY() {
			const { y } = this.toAffine();
			if (Fp.isOdd) return !Fp.isOdd(y);
			throw new Error("Field doesn't support isOdd");
		}
		equals(other) {
			assertPrjPoint(other);
			const { px: X1, py: Y1, pz: Z1 } = this;
			const { px: X2, py: Y2, pz: Z2 } = other;
			const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
			const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
			return U1 && U2;
		}
		negate() {
			return new Point(this.px, Fp.neg(this.py), this.pz);
		}
		double() {
			const { a, b } = CURVE;
			const b3 = Fp.mul(b, _3n2);
			const { px: X1, py: Y1, pz: Z1 } = this;
			let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
			let t0 = Fp.mul(X1, X1);
			const t1 = Fp.mul(Y1, Y1);
			let t2 = Fp.mul(Z1, Z1);
			let t3 = Fp.mul(X1, Y1);
			t3 = Fp.add(t3, t3);
			Z3 = Fp.mul(X1, Z1);
			Z3 = Fp.add(Z3, Z3);
			X3 = Fp.mul(a, Z3);
			Y3 = Fp.mul(b3, t2);
			Y3 = Fp.add(X3, Y3);
			X3 = Fp.sub(t1, Y3);
			Y3 = Fp.add(t1, Y3);
			Y3 = Fp.mul(X3, Y3);
			X3 = Fp.mul(t3, X3);
			Z3 = Fp.mul(b3, Z3);
			t2 = Fp.mul(a, t2);
			t3 = Fp.sub(t0, t2);
			t3 = Fp.mul(a, t3);
			t3 = Fp.add(t3, Z3);
			Z3 = Fp.add(t0, t0);
			t0 = Fp.add(Z3, t0);
			t0 = Fp.add(t0, t2);
			t0 = Fp.mul(t0, t3);
			Y3 = Fp.add(Y3, t0);
			t2 = Fp.mul(Y1, Z1);
			t2 = Fp.add(t2, t2);
			t0 = Fp.mul(t2, t3);
			X3 = Fp.sub(X3, t0);
			Z3 = Fp.mul(t2, t1);
			Z3 = Fp.add(Z3, Z3);
			Z3 = Fp.add(Z3, Z3);
			return new Point(X3, Y3, Z3);
		}
		add(other) {
			assertPrjPoint(other);
			const { px: X1, py: Y1, pz: Z1 } = this;
			const { px: X2, py: Y2, pz: Z2 } = other;
			let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
			const a = CURVE.a;
			const b3 = Fp.mul(CURVE.b, _3n2);
			let t0 = Fp.mul(X1, X2);
			let t1 = Fp.mul(Y1, Y2);
			let t2 = Fp.mul(Z1, Z2);
			let t3 = Fp.add(X1, Y1);
			let t4 = Fp.add(X2, Y2);
			t3 = Fp.mul(t3, t4);
			t4 = Fp.add(t0, t1);
			t3 = Fp.sub(t3, t4);
			t4 = Fp.add(X1, Z1);
			let t5 = Fp.add(X2, Z2);
			t4 = Fp.mul(t4, t5);
			t5 = Fp.add(t0, t2);
			t4 = Fp.sub(t4, t5);
			t5 = Fp.add(Y1, Z1);
			X3 = Fp.add(Y2, Z2);
			t5 = Fp.mul(t5, X3);
			X3 = Fp.add(t1, t2);
			t5 = Fp.sub(t5, X3);
			Z3 = Fp.mul(a, t4);
			X3 = Fp.mul(b3, t2);
			Z3 = Fp.add(X3, Z3);
			X3 = Fp.sub(t1, Z3);
			Z3 = Fp.add(t1, Z3);
			Y3 = Fp.mul(X3, Z3);
			t1 = Fp.add(t0, t0);
			t1 = Fp.add(t1, t0);
			t2 = Fp.mul(a, t2);
			t4 = Fp.mul(b3, t4);
			t1 = Fp.add(t1, t2);
			t2 = Fp.sub(t0, t2);
			t2 = Fp.mul(a, t2);
			t4 = Fp.add(t4, t2);
			t0 = Fp.mul(t1, t4);
			Y3 = Fp.add(Y3, t0);
			t0 = Fp.mul(t5, t4);
			X3 = Fp.mul(t3, X3);
			X3 = Fp.sub(X3, t0);
			t0 = Fp.mul(t3, t1);
			Z3 = Fp.mul(t5, Z3);
			Z3 = Fp.add(Z3, t0);
			return new Point(X3, Y3, Z3);
		}
		subtract(other) {
			return this.add(other.negate());
		}
		is0() {
			return this.equals(Point.ZERO);
		}
		wNAF(n) {
			return wnaf.wNAFCached(this, pointPrecomputes, n, (comp) => {
				const toInv = Fp.invertBatch(comp.map((p) => p.pz));
				return comp.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
			});
		}
		multiplyUnsafe(n) {
			const I = Point.ZERO;
			if (n === _0n4) return I;
			assertGE(n);
			if (n === _1n4) return this;
			const { endo } = CURVE;
			if (!endo) return wnaf.unsafeLadder(this, n);
			let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
			let k1p = I;
			let k2p = I;
			let d = this;
			while (k1 > _0n4 || k2 > _0n4) {
				if (k1 & _1n4) k1p = k1p.add(d);
				if (k2 & _1n4) k2p = k2p.add(d);
				d = d.double();
				k1 >>= _1n4;
				k2 >>= _1n4;
			}
			if (k1neg) k1p = k1p.negate();
			if (k2neg) k2p = k2p.negate();
			k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
			return k1p.add(k2p);
		}
		multiply(scalar) {
			assertGE(scalar);
			const n = scalar;
			let point, fake;
			const { endo } = CURVE;
			if (endo) {
				const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
				let { p: k1p, f: f1p } = this.wNAF(k1);
				let { p: k2p, f: f2p } = this.wNAF(k2);
				k1p = wnaf.constTimeNegate(k1neg, k1p);
				k2p = wnaf.constTimeNegate(k2neg, k2p);
				k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
				point = k1p.add(k2p);
				fake = f1p.add(f2p);
			} else {
				const { p, f } = this.wNAF(n);
				point = p;
				fake = f;
			}
			return Point.normalizeZ([point, fake])[0];
		}
		multiplyAndAddUnsafe(Q, a, b) {
			const G = Point.BASE;
			const mul = (P, a2) =>
				a2 === _0n4 || a2 === _1n4 || !P.equals(G)
					? P.multiplyUnsafe(a2)
					: P.multiply(a2);
			const sum = mul(this, a).add(mul(Q, b));
			return sum.is0() ? undefined : sum;
		}
		toAffine(iz) {
			const { px: x, py: y, pz: z } = this;
			const is0 = this.is0();
			if (iz == null) iz = is0 ? Fp.ONE : Fp.inv(z);
			const ax = Fp.mul(x, iz);
			const ay = Fp.mul(y, iz);
			const zz = Fp.mul(z, iz);
			if (is0) return { x: Fp.ZERO, y: Fp.ZERO };
			if (!Fp.eql(zz, Fp.ONE)) throw new Error("invZ was invalid");
			return { x: ax, y: ay };
		}
		isTorsionFree() {
			const { h: cofactor, isTorsionFree } = CURVE;
			if (cofactor === _1n4) return true;
			if (isTorsionFree) return isTorsionFree(Point, this);
			throw new Error(
				"isTorsionFree() has not been declared for the elliptic curve",
			);
		}
		clearCofactor() {
			const { h: cofactor, clearCofactor } = CURVE;
			if (cofactor === _1n4) return this;
			if (clearCofactor) return clearCofactor(Point, this);
			return this.multiplyUnsafe(CURVE.h);
		}
		toRawBytes(isCompressed = true) {
			this.assertValidity();
			return toBytes2(Point, this, isCompressed);
		}
		toHex(isCompressed = true) {
			return bytesToHex(this.toRawBytes(isCompressed));
		}
	}
	Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
	Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
	const _bits = CURVE.nBitLength;
	const wnaf = wNAF(Point, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
	return {
		CURVE,
		ProjectivePoint: Point,
		normPrivateKeyToScalar,
		weierstrassEquation,
		isWithinCurveOrder,
	};
}
function validateOpts(curve) {
	const opts = validateBasic(curve);
	validateObject(
		opts,
		{
			hash: "hash",
			hmac: "function",
			randomBytes: "function",
		},
		{
			bits2int: "function",
			bits2int_modN: "function",
			lowS: "boolean",
		},
	);
	return Object.freeze({ lowS: true, ...opts });
}
function weierstrass(curveDef) {
	const CURVE = validateOpts(curveDef);
	const { Fp, n: CURVE_ORDER } = CURVE;
	const compressedLen = Fp.BYTES + 1;
	const uncompressedLen = 2 * Fp.BYTES + 1;
	function isValidFieldElement(num) {
		return _0n4 < num && num < Fp.ORDER;
	}
	function modN(a) {
		return mod(a, CURVE_ORDER);
	}
	function invN(a) {
		return invert(a, CURVE_ORDER);
	}
	const {
		ProjectivePoint: Point,
		normPrivateKeyToScalar,
		weierstrassEquation,
		isWithinCurveOrder,
	} = weierstrassPoints({
		...CURVE,
		toBytes(_c, point, isCompressed) {
			const a = point.toAffine();
			const x = Fp.toBytes(a.x);
			const cat = concatBytes2;
			if (isCompressed) {
				return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
			} else {
				return cat(Uint8Array.from([4]), x, Fp.toBytes(a.y));
			}
		},
		fromBytes(bytes2) {
			const len = bytes2.length;
			const head = bytes2[0];
			const tail = bytes2.subarray(1);
			if (len === compressedLen && (head === 2 || head === 3)) {
				const x = bytesToNumberBE(tail);
				if (!isValidFieldElement(x)) throw new Error("Point is not on curve");
				const y2 = weierstrassEquation(x);
				let y = Fp.sqrt(y2);
				const isYOdd = (y & _1n4) === _1n4;
				const isHeadOdd = (head & 1) === 1;
				if (isHeadOdd !== isYOdd) y = Fp.neg(y);
				return { x, y };
			} else if (len === uncompressedLen && head === 4) {
				const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
				const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
				return { x, y };
			} else {
				throw new Error(
					`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`,
				);
			}
		},
	});
	const numToNByteStr = (num) =>
		bytesToHex(numberToBytesBE(num, CURVE.nByteLength));
	function isBiggerThanHalfOrder(number2) {
		const HALF = CURVE_ORDER >> _1n4;
		return number2 > HALF;
	}
	function normalizeS(s) {
		return isBiggerThanHalfOrder(s) ? modN(-s) : s;
	}
	const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));

	class Signature {
		constructor(r, s, recovery) {
			this.r = r;
			this.s = s;
			this.recovery = recovery;
			this.assertValidity();
		}
		static fromCompact(hex) {
			const l = CURVE.nByteLength;
			hex = ensureBytes("compactSignature", hex, l * 2);
			return new Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
		}
		static fromDER(hex) {
			const { r, s } = DER.toSig(ensureBytes("DER", hex));
			return new Signature(r, s);
		}
		assertValidity() {
			if (!isWithinCurveOrder(this.r))
				throw new Error("r must be 0 < r < CURVE.n");
			if (!isWithinCurveOrder(this.s))
				throw new Error("s must be 0 < s < CURVE.n");
		}
		addRecoveryBit(recovery) {
			return new Signature(this.r, this.s, recovery);
		}
		recoverPublicKey(msgHash) {
			const { r, s, recovery: rec } = this;
			const h = bits2int_modN(ensureBytes("msgHash", msgHash));
			if (rec == null || ![0, 1, 2, 3].includes(rec))
				throw new Error("recovery id invalid");
			const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
			if (radj >= Fp.ORDER) throw new Error("recovery id 2 or 3 invalid");
			const prefix = (rec & 1) === 0 ? "02" : "03";
			const R = Point.fromHex(prefix + numToNByteStr(radj));
			const ir = invN(radj);
			const u1 = modN(-h * ir);
			const u2 = modN(s * ir);
			const Q = Point.BASE.multiplyAndAddUnsafe(R, u1, u2);
			if (!Q) throw new Error("point at infinify");
			Q.assertValidity();
			return Q;
		}
		hasHighS() {
			return isBiggerThanHalfOrder(this.s);
		}
		normalizeS() {
			return this.hasHighS()
				? new Signature(this.r, modN(-this.s), this.recovery)
				: this;
		}
		toDERRawBytes() {
			return hexToBytes(this.toDERHex());
		}
		toDERHex() {
			return DER.hexFromSig({ r: this.r, s: this.s });
		}
		toCompactRawBytes() {
			return hexToBytes(this.toCompactHex());
		}
		toCompactHex() {
			return numToNByteStr(this.r) + numToNByteStr(this.s);
		}
	}
	const utils = {
		isValidPrivateKey(privateKey) {
			try {
				normPrivateKeyToScalar(privateKey);
				return true;
			} catch (error) {
				return false;
			}
		},
		normPrivateKeyToScalar,
		randomPrivateKey: () => {
			const length = getMinHashLength(CURVE.n);
			return mapHashToField(CURVE.randomBytes(length), CURVE.n);
		},
		precompute(windowSize = 8, point = Point.BASE) {
			point._setWindowSize(windowSize);
			point.multiply(BigInt(3));
			return point;
		},
	};
	function getPublicKey(privateKey, isCompressed = true) {
		return Point.fromPrivateKey(privateKey).toRawBytes(isCompressed);
	}
	function isProbPub(item) {
		const arr = item instanceof Uint8Array;
		const str = typeof item === "string";
		const len = (arr || str) && item.length;
		if (arr) return len === compressedLen || len === uncompressedLen;
		if (str) return len === 2 * compressedLen || len === 2 * uncompressedLen;
		if (item instanceof Point) return true;
		return false;
	}
	function getSharedSecret(privateA, publicB, isCompressed = true) {
		if (isProbPub(privateA)) throw new Error("first arg must be private key");
		if (!isProbPub(publicB)) throw new Error("second arg must be public key");
		const b = Point.fromHex(publicB);
		return b
			.multiply(normPrivateKeyToScalar(privateA))
			.toRawBytes(isCompressed);
	}
	const bits2int =
		CURVE.bits2int ||
		((bytes2) => {
			const num = bytesToNumberBE(bytes2);
			const delta = bytes2.length * 8 - CURVE.nBitLength;
			return delta > 0 ? num >> BigInt(delta) : num;
		});
	const bits2int_modN =
		CURVE.bits2int_modN || ((bytes2) => modN(bits2int(bytes2)));
	const ORDER_MASK = bitMask(CURVE.nBitLength);
	function int2octets(num) {
		if (typeof num !== "bigint") throw new Error("bigint expected");
		if (!(_0n4 <= num && num < ORDER_MASK))
			throw new Error(`bigint expected < 2^${CURVE.nBitLength}`);
		return numberToBytesBE(num, CURVE.nByteLength);
	}
	function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
		if (["recovered", "canonical"].some((k) => k in opts))
			throw new Error("sign() legacy options not supported");
		const { hash: hash2, randomBytes: randomBytes2 } = CURVE;
		let { lowS, prehash, extraEntropy: ent } = opts;
		if (lowS == null) lowS = true;
		msgHash = ensureBytes("msgHash", msgHash);
		if (prehash) msgHash = ensureBytes("prehashed msgHash", hash2(msgHash));
		const h1int = bits2int_modN(msgHash);
		const d = normPrivateKeyToScalar(privateKey);
		const seedArgs = [int2octets(d), int2octets(h1int)];
		if (ent != null) {
			const e = ent === true ? randomBytes2(Fp.BYTES) : ent;
			seedArgs.push(ensureBytes("extraEntropy", e));
		}
		const seed = concatBytes2(...seedArgs);
		const m = h1int;
		function k2sig(kBytes) {
			const k = bits2int(kBytes);
			if (!isWithinCurveOrder(k)) return;
			const ik = invN(k);
			const q = Point.BASE.multiply(k).toAffine();
			const r = modN(q.x);
			if (r === _0n4) return;
			const s = modN(ik * modN(m + r * d));
			if (s === _0n4) return;
			let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
			let normS = s;
			if (lowS && isBiggerThanHalfOrder(s)) {
				normS = normalizeS(s);
				recovery ^= 1;
			}
			return new Signature(r, normS, recovery);
		}
		return { seed, k2sig };
	}
	const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
	const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
	function sign(msgHash, privKey, opts = defaultSigOpts) {
		const { seed, k2sig } = prepSig(msgHash, privKey, opts);
		const C = CURVE;
		const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
		return drbg(seed, k2sig);
	}
	Point.BASE._setWindowSize(8);
	function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
		const sg = signature;
		msgHash = ensureBytes("msgHash", msgHash);
		publicKey = ensureBytes("publicKey", publicKey);
		if ("strict" in opts) throw new Error("options.strict was renamed to lowS");
		const { lowS, prehash } = opts;
		let _sig = undefined;
		let P;
		try {
			if (typeof sg === "string" || sg instanceof Uint8Array) {
				try {
					_sig = Signature.fromDER(sg);
				} catch (derError) {
					if (!(derError instanceof DER.Err)) throw derError;
					_sig = Signature.fromCompact(sg);
				}
			} else if (
				typeof sg === "object" &&
				typeof sg.r === "bigint" &&
				typeof sg.s === "bigint"
			) {
				const { r: r2, s: s2 } = sg;
				_sig = new Signature(r2, s2);
			} else {
				throw new Error("PARSE");
			}
			P = Point.fromHex(publicKey);
		} catch (error) {
			if (error.message === "PARSE")
				throw new Error(
					`signature must be Signature instance, Uint8Array or hex string`,
				);
			return false;
		}
		if (lowS && _sig.hasHighS()) return false;
		if (prehash) msgHash = CURVE.hash(msgHash);
		const { r, s } = _sig;
		const h = bits2int_modN(msgHash);
		const is = invN(s);
		const u1 = modN(h * is);
		const u2 = modN(r * is);
		const R = Point.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine();
		if (!R) return false;
		const v = modN(R.x);
		return v === r;
	}
	return {
		CURVE,
		getPublicKey,
		getSharedSecret,
		sign,
		verify,
		ProjectivePoint: Point,
		Signature,
		utils,
	};
}

// node_modules/nostr-tools/node_modules/@noble/curves/node_modules/@noble/hashes/esm/hmac.js
class HMAC extends Hash {
	constructor(hash2, _key) {
		super();
		this.finished = false;
		this.destroyed = false;
		hash(hash2);
		const key = toBytes(_key);
		this.iHash = hash2.create();
		if (typeof this.iHash.update !== "function")
			throw new Error("Expected instance of class which extends utils.Hash");
		this.blockLen = this.iHash.blockLen;
		this.outputLen = this.iHash.outputLen;
		const blockLen = this.blockLen;
		const pad = new Uint8Array(blockLen);
		pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
		for (let i = 0; i < pad.length; i++) pad[i] ^= 54;
		this.iHash.update(pad);
		this.oHash = hash2.create();
		for (let i = 0; i < pad.length; i++) pad[i] ^= 54 ^ 92;
		this.oHash.update(pad);
		pad.fill(0);
	}
	update(buf) {
		exists(this);
		this.iHash.update(buf);
		return this;
	}
	digestInto(out) {
		exists(this);
		bytes(out, this.outputLen);
		this.finished = true;
		this.iHash.digestInto(out);
		this.oHash.update(out);
		this.oHash.digestInto(out);
		this.destroy();
	}
	digest() {
		const out = new Uint8Array(this.oHash.outputLen);
		this.digestInto(out);
		return out;
	}
	_cloneInto(to) {
		to || (to = Object.create(Object.getPrototypeOf(this), {}));
		const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
		to = to;
		to.finished = finished;
		to.destroyed = destroyed;
		to.blockLen = blockLen;
		to.outputLen = outputLen;
		to.oHash = oHash._cloneInto(to.oHash);
		to.iHash = iHash._cloneInto(to.iHash);
		return to;
	}
	destroy() {
		this.destroyed = true;
		this.oHash.destroy();
		this.iHash.destroy();
	}
}
var hmac = (hash2, key, message) =>
	new HMAC(hash2, key).update(message).digest();
hmac.create = (hash2, key) => new HMAC(hash2, key);

// node_modules/nostr-tools/node_modules/@noble/curves/esm/_shortw_utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function getHash(hash2) {
	return {
		hash: hash2,
		hmac: (key, ...msgs) => hmac(hash2, key, concatBytes(...msgs)),
		randomBytes,
	};
}
function createCurve(curveDef, defHash) {
	const create = (hash2) => weierstrass({ ...curveDef, ...getHash(hash2) });
	return Object.freeze({ ...create(defHash), create });
}

// node_modules/nostr-tools/node_modules/@noble/curves/esm/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1P = BigInt(
	"0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
);
var secp256k1N = BigInt(
	"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
var _1n5 = BigInt(1);
var _2n4 = BigInt(2);
var divNearest = (a, b) => (a + b / _2n4) / b;
function sqrtMod(y) {
	const P = secp256k1P;
	const _3n3 = BigInt(3),
		_6n = BigInt(6),
		_11n = BigInt(11),
		_22n = BigInt(22);
	const _23n = BigInt(23),
		_44n = BigInt(44),
		_88n = BigInt(88);
	const b2 = (y * y * y) % P;
	const b3 = (b2 * b2 * y) % P;
	const b6 = (pow2(b3, _3n3, P) * b3) % P;
	const b9 = (pow2(b6, _3n3, P) * b3) % P;
	const b11 = (pow2(b9, _2n4, P) * b2) % P;
	const b22 = (pow2(b11, _11n, P) * b11) % P;
	const b44 = (pow2(b22, _22n, P) * b22) % P;
	const b88 = (pow2(b44, _44n, P) * b44) % P;
	const b176 = (pow2(b88, _88n, P) * b88) % P;
	const b220 = (pow2(b176, _44n, P) * b44) % P;
	const b223 = (pow2(b220, _3n3, P) * b3) % P;
	const t1 = (pow2(b223, _23n, P) * b22) % P;
	const t2 = (pow2(t1, _6n, P) * b2) % P;
	const root = pow2(t2, _2n4, P);
	if (!Fp.eql(Fp.sqr(root), y)) throw new Error("Cannot find square root");
	return root;
}
var Fp = Field(secp256k1P, undefined, undefined, { sqrt: sqrtMod });
var secp256k1 = createCurve(
	{
		a: BigInt(0),
		b: BigInt(7),
		Fp,
		n: secp256k1N,
		Gx: BigInt(
			"55066263022277343669578718895168534326250603453777594175500187360389116729240",
		),
		Gy: BigInt(
			"32670510020758816978083085130507043184471273380659243275938904335757337482424",
		),
		h: BigInt(1),
		lowS: true,
		endo: {
			beta: BigInt(
				"0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
			),
			splitScalar: (k) => {
				const n = secp256k1N;
				const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
				const b1 = -_1n5 * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
				const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
				const b2 = a1;
				const POW_2_128 = BigInt("0x100000000000000000000000000000000");
				const c1 = divNearest(b2 * k, n);
				const c2 = divNearest(-b1 * k, n);
				let k1 = mod(k - c1 * a1 - c2 * a2, n);
				let k2 = mod(-c1 * b1 - c2 * b2, n);
				const k1neg = k1 > POW_2_128;
				const k2neg = k2 > POW_2_128;
				if (k1neg) k1 = n - k1;
				if (k2neg) k2 = n - k2;
				if (k1 > POW_2_128 || k2 > POW_2_128) {
					throw new Error("splitScalar: Endomorphism failed, k=" + k);
				}
				return { k1neg, k1, k2neg, k2 };
			},
		},
	},
	sha256,
);
var _0n5 = BigInt(0);
var fe = (x) => typeof x === "bigint" && _0n5 < x && x < secp256k1P;
var ge = (x) => typeof x === "bigint" && _0n5 < x && x < secp256k1N;
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
	let tagP = TAGGED_HASH_PREFIXES[tag];
	if (tagP === undefined) {
		const tagH = sha256(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
		tagP = concatBytes2(tagH, tagH);
		TAGGED_HASH_PREFIXES[tag] = tagP;
	}
	return sha256(concatBytes2(tagP, ...messages));
}
var pointToBytes = (point) => point.toRawBytes(true).slice(1);
var numTo32b = (n) => numberToBytesBE(n, 32);
var modP = (x) => mod(x, secp256k1P);
var modN = (x) => mod(x, secp256k1N);
var Point = secp256k1.ProjectivePoint;
var GmulAdd = (Q, a, b) => Point.BASE.multiplyAndAddUnsafe(Q, a, b);
function schnorrGetExtPubKey(priv) {
	const d_ = secp256k1.utils.normPrivateKeyToScalar(priv);
	const p = Point.fromPrivateKey(d_);
	const scalar = p.hasEvenY() ? d_ : modN(-d_);
	return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
	if (!fe(x)) throw new Error("bad x: need 0 < x < p");
	const xx = modP(x * x);
	const c = modP(xx * x + BigInt(7));
	let y = sqrtMod(c);
	if (y % _2n4 !== _0n5) y = modP(-y);
	const p = new Point(x, y, _1n5);
	p.assertValidity();
	return p;
}
function challenge(...args) {
	return modN(bytesToNumberBE(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(privateKey) {
	return schnorrGetExtPubKey(privateKey).bytes;
}
function schnorrSign(message, privateKey, auxRand = randomBytes(32)) {
	const m = ensureBytes("message", message);
	const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey);
	const a = ensureBytes("auxRand", auxRand, 32);
	const t = numTo32b(d ^ bytesToNumberBE(taggedHash("BIP0340/aux", a)));
	const rand = taggedHash("BIP0340/nonce", t, px, m);
	const k_ = modN(bytesToNumberBE(rand));
	if (k_ === _0n5) throw new Error("sign failed: k is zero");
	const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_);
	const e = challenge(rx, px, m);
	const sig = new Uint8Array(64);
	sig.set(rx, 0);
	sig.set(numTo32b(modN(k + e * d)), 32);
	if (!schnorrVerify(sig, m, px))
		throw new Error("sign: Invalid signature produced");
	return sig;
}
function schnorrVerify(signature, message, publicKey) {
	const sig = ensureBytes("signature", signature, 64);
	const m = ensureBytes("message", message);
	const pub = ensureBytes("publicKey", publicKey, 32);
	try {
		const P = lift_x(bytesToNumberBE(pub));
		const r = bytesToNumberBE(sig.subarray(0, 32));
		if (!fe(r)) return false;
		const s = bytesToNumberBE(sig.subarray(32, 64));
		if (!ge(s)) return false;
		const e = challenge(numTo32b(r), pointToBytes(P), m);
		const R = GmulAdd(P, s, modN(-e));
		if (!R || !R.hasEvenY() || R.toAffine().x !== r) return false;
		return true;
	} catch (error) {
		return false;
	}
}
var schnorr = /* @__PURE__ */ (() => ({
	getPublicKey: schnorrGetPublicKey,
	sign: schnorrSign,
	verify: schnorrVerify,
	utils: {
		randomPrivateKey: secp256k1.utils.randomPrivateKey,
		lift_x,
		pointToBytes,
		numberToBytesBE,
		bytesToNumberBE,
		taggedHash,
		mod,
	},
}))();

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/cryptoNode.js
import * as nc2 from "node:crypto";
var crypto2 =
	nc2 && typeof nc2 === "object" && "webcrypto" in nc2
		? nc2.webcrypto
		: undefined;

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/utils.js
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var u8a3 = (a) => a instanceof Uint8Array;
var createView2 = (arr) =>
	new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
var rotr2 = (word, shift) => (word << (32 - shift)) | (word >>> shift);
var isLE2 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE2) throw new Error("Non little-endian hardware is not supported");
var hexes2 = Array.from({ length: 256 }, (v, i) =>
	i.toString(16).padStart(2, "0"),
);
function bytesToHex2(bytes2) {
	if (!u8a3(bytes2)) throw new Error("Uint8Array expected");
	let hex = "";
	for (let i = 0; i < bytes2.length; i++) {
		hex += hexes2[bytes2[i]];
	}
	return hex;
}
function hexToBytes2(hex) {
	if (typeof hex !== "string")
		throw new Error("hex string expected, got " + typeof hex);
	const len = hex.length;
	if (len % 2)
		throw new Error(
			"padded hex string expected, got unpadded hex of length " + len,
		);
	const array = new Uint8Array(len / 2);
	for (let i = 0; i < array.length; i++) {
		const j = i * 2;
		const hexByte = hex.slice(j, j + 2);
		const byte = Number.parseInt(hexByte, 16);
		if (Number.isNaN(byte) || byte < 0)
			throw new Error("Invalid byte sequence");
		array[i] = byte;
	}
	return array;
}
function utf8ToBytes3(str) {
	if (typeof str !== "string")
		throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
	return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes2(data) {
	if (typeof data === "string") data = utf8ToBytes3(data);
	if (!u8a3(data)) throw new Error(`expected Uint8Array, got ${typeof data}`);
	return data;
}
function concatBytes3(...arrays) {
	const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
	let pad = 0;
	arrays.forEach((a) => {
		if (!u8a3(a)) throw new Error("Uint8Array expected");
		r.set(a, pad);
		pad += a.length;
	});
	return r;
}

class Hash2 {
	clone() {
		return this._cloneInto();
	}
}
function wrapConstructor2(hashCons) {
	const hashC = (msg) => hashCons().update(toBytes2(msg)).digest();
	const tmp = hashCons();
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = () => hashCons();
	return hashC;
}
function randomBytes2(bytesLength = 32) {
	if (crypto2 && typeof crypto2.getRandomValues === "function") {
		return crypto2.getRandomValues(new Uint8Array(bytesLength));
	}
	throw new Error("crypto.getRandomValues must be defined");
}

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/_assert.js
function number2(n) {
	if (!Number.isSafeInteger(n) || n < 0)
		throw new Error(`Wrong positive integer: ${n}`);
}
function bool(b) {
	if (typeof b !== "boolean") throw new Error(`Expected boolean, not ${b}`);
}
function bytes2(b, ...lengths) {
	if (!(b instanceof Uint8Array)) throw new Error("Expected Uint8Array");
	if (lengths.length > 0 && !lengths.includes(b.length))
		throw new Error(
			`Expected Uint8Array of length ${lengths}, not of length=${b.length}`,
		);
}
function hash2(hash3) {
	if (typeof hash3 !== "function" || typeof hash3.create !== "function")
		throw new Error("Hash should be wrapped by utils.wrapConstructor");
	number2(hash3.outputLen);
	number2(hash3.blockLen);
}
function exists2(instance, checkFinished = true) {
	if (instance.destroyed) throw new Error("Hash instance has been destroyed");
	if (checkFinished && instance.finished)
		throw new Error("Hash#digest() has already been called");
}
function output2(out, instance) {
	bytes2(out);
	const min = instance.outputLen;
	if (out.length < min) {
		throw new Error(
			`digestInto() expects output buffer of length at least ${min}`,
		);
	}
}
var assert = {
	number: number2,
	bool,
	bytes: bytes2,
	hash: hash2,
	exists: exists2,
	output: output2,
};
var _assert_default = assert;

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/_sha2.js
function setBigUint642(view, byteOffset, value, isLE3) {
	if (typeof view.setBigUint64 === "function")
		return view.setBigUint64(byteOffset, value, isLE3);
	const _32n = BigInt(32);
	const _u32_max = BigInt(4294967295);
	const wh = Number((value >> _32n) & _u32_max);
	const wl = Number(value & _u32_max);
	const h = isLE3 ? 4 : 0;
	const l = isLE3 ? 0 : 4;
	view.setUint32(byteOffset + h, wh, isLE3);
	view.setUint32(byteOffset + l, wl, isLE3);
}

class SHA22 extends Hash2 {
	constructor(blockLen, outputLen, padOffset, isLE3) {
		super();
		this.blockLen = blockLen;
		this.outputLen = outputLen;
		this.padOffset = padOffset;
		this.isLE = isLE3;
		this.finished = false;
		this.length = 0;
		this.pos = 0;
		this.destroyed = false;
		this.buffer = new Uint8Array(blockLen);
		this.view = createView2(this.buffer);
	}
	update(data) {
		_assert_default.exists(this);
		const { view, buffer, blockLen } = this;
		data = toBytes2(data);
		const len = data.length;
		for (let pos = 0; pos < len; ) {
			const take = Math.min(blockLen - this.pos, len - pos);
			if (take === blockLen) {
				const dataView = createView2(data);
				for (; blockLen <= len - pos; pos += blockLen)
					this.process(dataView, pos);
				continue;
			}
			buffer.set(data.subarray(pos, pos + take), this.pos);
			this.pos += take;
			pos += take;
			if (this.pos === blockLen) {
				this.process(view, 0);
				this.pos = 0;
			}
		}
		this.length += data.length;
		this.roundClean();
		return this;
	}
	digestInto(out) {
		_assert_default.exists(this);
		_assert_default.output(out, this);
		this.finished = true;
		const { buffer, view, blockLen, isLE: isLE3 } = this;
		let { pos } = this;
		buffer[pos++] = 128;
		this.buffer.subarray(pos).fill(0);
		if (this.padOffset > blockLen - pos) {
			this.process(view, 0);
			pos = 0;
		}
		for (let i = pos; i < blockLen; i++) buffer[i] = 0;
		setBigUint642(view, blockLen - 8, BigInt(this.length * 8), isLE3);
		this.process(view, 0);
		const oview = createView2(out);
		const len = this.outputLen;
		if (len % 4) throw new Error("_sha2: outputLen should be aligned to 32bit");
		const outLen = len / 4;
		const state = this.get();
		if (outLen > state.length)
			throw new Error("_sha2: outputLen bigger than state");
		for (let i = 0; i < outLen; i++) oview.setUint32(4 * i, state[i], isLE3);
	}
	digest() {
		const { buffer, outputLen } = this;
		this.digestInto(buffer);
		const res = buffer.slice(0, outputLen);
		this.destroy();
		return res;
	}
	_cloneInto(to) {
		to || (to = new this.constructor());
		to.set(...this.get());
		const { blockLen, buffer, length, finished, destroyed, pos } = this;
		to.length = length;
		to.pos = pos;
		to.finished = finished;
		to.destroyed = destroyed;
		if (length % blockLen) to.buffer.set(buffer);
		return to;
	}
}

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/sha256.js
var Chi2 = (a, b, c) => (a & b) ^ (~a & c);
var Maj2 = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
var SHA256_K2 = new Uint32Array([
	1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
	2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
	1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
	264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
	2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
	113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
	1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
	3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
	430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063,
	1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474,
	2756734187, 3204031479, 3329325298,
]);
var IV2 = new Uint32Array([
	1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
	528734635, 1541459225,
]);
var SHA256_W2 = new Uint32Array(64);

class SHA2562 extends SHA22 {
	constructor() {
		super(64, 32, 8, false);
		this.A = IV2[0] | 0;
		this.B = IV2[1] | 0;
		this.C = IV2[2] | 0;
		this.D = IV2[3] | 0;
		this.E = IV2[4] | 0;
		this.F = IV2[5] | 0;
		this.G = IV2[6] | 0;
		this.H = IV2[7] | 0;
	}
	get() {
		const { A, B, C, D, E, F, G, H } = this;
		return [A, B, C, D, E, F, G, H];
	}
	set(A, B, C, D, E, F, G, H) {
		this.A = A | 0;
		this.B = B | 0;
		this.C = C | 0;
		this.D = D | 0;
		this.E = E | 0;
		this.F = F | 0;
		this.G = G | 0;
		this.H = H | 0;
	}
	process(view, offset) {
		for (let i = 0; i < 16; i++, offset += 4)
			SHA256_W2[i] = view.getUint32(offset, false);
		for (let i = 16; i < 64; i++) {
			const W15 = SHA256_W2[i - 15];
			const W2 = SHA256_W2[i - 2];
			const s0 = rotr2(W15, 7) ^ rotr2(W15, 18) ^ (W15 >>> 3);
			const s1 = rotr2(W2, 17) ^ rotr2(W2, 19) ^ (W2 >>> 10);
			SHA256_W2[i] = (s1 + SHA256_W2[i - 7] + s0 + SHA256_W2[i - 16]) | 0;
		}
		let { A, B, C, D, E, F, G, H } = this;
		for (let i = 0; i < 64; i++) {
			const sigma1 = rotr2(E, 6) ^ rotr2(E, 11) ^ rotr2(E, 25);
			const T1 = (H + sigma1 + Chi2(E, F, G) + SHA256_K2[i] + SHA256_W2[i]) | 0;
			const sigma0 = rotr2(A, 2) ^ rotr2(A, 13) ^ rotr2(A, 22);
			const T2 = (sigma0 + Maj2(A, B, C)) | 0;
			H = G;
			G = F;
			F = E;
			E = (D + T1) | 0;
			D = C;
			C = B;
			B = A;
			A = (T1 + T2) | 0;
		}
		A = (A + this.A) | 0;
		B = (B + this.B) | 0;
		C = (C + this.C) | 0;
		D = (D + this.D) | 0;
		E = (E + this.E) | 0;
		F = (F + this.F) | 0;
		G = (G + this.G) | 0;
		H = (H + this.H) | 0;
		this.set(A, B, C, D, E, F, G, H);
	}
	roundClean() {
		SHA256_W2.fill(0);
	}
	destroy() {
		this.set(0, 0, 0, 0, 0, 0, 0, 0);
		this.buffer.fill(0);
	}
}

class SHA224 extends SHA2562 {
	constructor() {
		super();
		this.A = 3238371032 | 0;
		this.B = 914150663 | 0;
		this.C = 812702999 | 0;
		this.D = 4144912697 | 0;
		this.E = 4290775857 | 0;
		this.F = 1750603025 | 0;
		this.G = 1694076839 | 0;
		this.H = 3204075428 | 0;
		this.outputLen = 28;
	}
}
var sha2562 = wrapConstructor2(() => new SHA2562());
var sha224 = wrapConstructor2(() => new SHA224());

// node_modules/nostr-tools/node_modules/@scure/base/lib/esm/index.js
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function assertNumber(n) {
	if (!Number.isSafeInteger(n)) throw new Error(`Wrong integer: ${n}`);
}
function chain(...args) {
	const wrap = (a, b) => (c) => a(b(c));
	const encode = Array.from(args)
		.reverse()
		.reduce((acc, i) => (acc ? wrap(acc, i.encode) : i.encode), undefined);
	const decode = args.reduce(
		(acc, i) => (acc ? wrap(acc, i.decode) : i.decode),
		undefined,
	);
	return { encode, decode };
}
function alphabet(alphabet2) {
	return {
		encode: (digits) => {
			if (
				!Array.isArray(digits) ||
				(digits.length && typeof digits[0] !== "number")
			)
				throw new Error("alphabet.encode input should be an array of numbers");
			return digits.map((i) => {
				assertNumber(i);
				if (i < 0 || i >= alphabet2.length)
					throw new Error(
						`Digit index outside alphabet: ${i} (alphabet: ${alphabet2.length})`,
					);
				return alphabet2[i];
			});
		},
		decode: (input) => {
			if (
				!Array.isArray(input) ||
				(input.length && typeof input[0] !== "string")
			)
				throw new Error("alphabet.decode input should be array of strings");
			return input.map((letter) => {
				if (typeof letter !== "string")
					throw new Error(`alphabet.decode: not string element=${letter}`);
				const index = alphabet2.indexOf(letter);
				if (index === -1)
					throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet2}`);
				return index;
			});
		},
	};
}
function join(separator = "") {
	if (typeof separator !== "string")
		throw new Error("join separator should be string");
	return {
		encode: (from) => {
			if (!Array.isArray(from) || (from.length && typeof from[0] !== "string"))
				throw new Error("join.encode input should be array of strings");
			for (const i of from)
				if (typeof i !== "string")
					throw new Error(`join.encode: non-string input=${i}`);
			return from.join(separator);
		},
		decode: (to) => {
			if (typeof to !== "string")
				throw new Error("join.decode input should be string");
			return to.split(separator);
		},
	};
}
function padding(bits, chr = "=") {
	assertNumber(bits);
	if (typeof chr !== "string") throw new Error("padding chr should be string");
	return {
		encode(data) {
			if (!Array.isArray(data) || (data.length && typeof data[0] !== "string"))
				throw new Error("padding.encode input should be array of strings");
			for (const i of data)
				if (typeof i !== "string")
					throw new Error(`padding.encode: non-string input=${i}`);
			while ((data.length * bits) % 8) data.push(chr);
			return data;
		},
		decode(input) {
			if (
				!Array.isArray(input) ||
				(input.length && typeof input[0] !== "string")
			)
				throw new Error("padding.encode input should be array of strings");
			for (const i of input)
				if (typeof i !== "string")
					throw new Error(`padding.decode: non-string input=${i}`);
			let end = input.length;
			if ((end * bits) % 8)
				throw new Error(
					"Invalid padding: string should have whole number of bytes",
				);
			for (; end > 0 && input[end - 1] === chr; end--) {
				if (!(((end - 1) * bits) % 8))
					throw new Error("Invalid padding: string has too much padding");
			}
			return input.slice(0, end);
		},
	};
}
function normalize(fn) {
	if (typeof fn !== "function")
		throw new Error("normalize fn should be function");
	return { encode: (from) => from, decode: (to) => fn(to) };
}
function convertRadix(data, from, to) {
	if (from < 2)
		throw new Error(
			`convertRadix: wrong from=${from}, base cannot be less than 2`,
		);
	if (to < 2)
		throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
	if (!Array.isArray(data))
		throw new Error("convertRadix: data should be array");
	if (!data.length) return [];
	let pos = 0;
	const res = [];
	const digits = Array.from(data);
	digits.forEach((d) => {
		assertNumber(d);
		if (d < 0 || d >= from) throw new Error(`Wrong integer: ${d}`);
	});
	while (true) {
		let carry = 0;
		let done = true;
		for (let i = pos; i < digits.length; i++) {
			const digit = digits[i];
			const digitBase = from * carry + digit;
			if (
				!Number.isSafeInteger(digitBase) ||
				(from * carry) / from !== carry ||
				digitBase - digit !== from * carry
			) {
				throw new Error("convertRadix: carry overflow");
			}
			carry = digitBase % to;
			digits[i] = Math.floor(digitBase / to);
			if (
				!Number.isSafeInteger(digits[i]) ||
				digits[i] * to + carry !== digitBase
			)
				throw new Error("convertRadix: carry overflow");
			if (!done) continue;
			else if (!digits[i]) pos = i;
			else done = false;
		}
		res.push(carry);
		if (done) break;
	}
	for (let i = 0; i < data.length - 1 && data[i] === 0; i++) res.push(0);
	return res.reverse();
}
var gcd = (a, b) => (!b ? a : gcd(b, a % b));
var radix2carry = (from, to) => from + (to - gcd(from, to));
function convertRadix2(data, from, to, padding2) {
	if (!Array.isArray(data))
		throw new Error("convertRadix2: data should be array");
	if (from <= 0 || from > 32)
		throw new Error(`convertRadix2: wrong from=${from}`);
	if (to <= 0 || to > 32) throw new Error(`convertRadix2: wrong to=${to}`);
	if (radix2carry(from, to) > 32) {
		throw new Error(
			`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`,
		);
	}
	let carry = 0;
	let pos = 0;
	const mask = 2 ** to - 1;
	const res = [];
	for (const n of data) {
		assertNumber(n);
		if (n >= 2 ** from)
			throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
		carry = (carry << from) | n;
		if (pos + from > 32)
			throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
		pos += from;
		for (; pos >= to; pos -= to) res.push(((carry >> (pos - to)) & mask) >>> 0);
		carry &= 2 ** pos - 1;
	}
	carry = (carry << (to - pos)) & mask;
	if (!padding2 && pos >= from) throw new Error("Excess padding");
	if (!padding2 && carry) throw new Error(`Non-zero padding: ${carry}`);
	if (padding2 && pos > 0) res.push(carry >>> 0);
	return res;
}
function radix(num) {
	assertNumber(num);
	return {
		encode: (bytes3) => {
			if (!(bytes3 instanceof Uint8Array))
				throw new Error("radix.encode input should be Uint8Array");
			return convertRadix(Array.from(bytes3), 2 ** 8, num);
		},
		decode: (digits) => {
			if (
				!Array.isArray(digits) ||
				(digits.length && typeof digits[0] !== "number")
			)
				throw new Error("radix.decode input should be array of strings");
			return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
		},
	};
}
function radix2(bits, revPadding = false) {
	assertNumber(bits);
	if (bits <= 0 || bits > 32)
		throw new Error("radix2: bits should be in (0..32]");
	if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
		throw new Error("radix2: carry overflow");
	return {
		encode: (bytes3) => {
			if (!(bytes3 instanceof Uint8Array))
				throw new Error("radix2.encode input should be Uint8Array");
			return convertRadix2(Array.from(bytes3), 8, bits, !revPadding);
		},
		decode: (digits) => {
			if (
				!Array.isArray(digits) ||
				(digits.length && typeof digits[0] !== "number")
			)
				throw new Error("radix2.decode input should be array of strings");
			return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
		},
	};
}
function unsafeWrapper(fn) {
	if (typeof fn !== "function")
		throw new Error("unsafeWrapper fn should be function");
	return (...args) => {
		try {
			return fn.apply(null, args);
		} catch (e) {}
	};
}
var base16 = chain(radix2(4), alphabet("0123456789ABCDEF"), join(""));
var base32 = chain(
	radix2(5),
	alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"),
	padding(5),
	join(""),
);
var base32hex = chain(
	radix2(5),
	alphabet("0123456789ABCDEFGHIJKLMNOPQRSTUV"),
	padding(5),
	join(""),
);
var base32crockford = chain(
	radix2(5),
	alphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ"),
	join(""),
	normalize((s) => s.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1")),
);
var base64 = chain(
	radix2(6),
	alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"),
	padding(6),
	join(""),
);
var base64url = chain(
	radix2(6),
	alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"),
	padding(6),
	join(""),
);
var genBase58 = (abc) => chain(radix(58), alphabet(abc), join(""));
var base58 = genBase58(
	"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
);
var base58flickr = genBase58(
	"123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
);
var base58xrp = genBase58(
	"rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz",
);
var XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
var base58xmr = {
	encode(data) {
		let res = "";
		for (let i = 0; i < data.length; i += 8) {
			const block = data.subarray(i, i + 8);
			res += base58.encode(block).padStart(XMR_BLOCK_LEN[block.length], "1");
		}
		return res;
	},
	decode(str) {
		let res = [];
		for (let i = 0; i < str.length; i += 11) {
			const slice = str.slice(i, i + 11);
			const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
			const block = base58.decode(slice);
			for (let j = 0; j < block.length - blockLen; j++) {
				if (block[j] !== 0) throw new Error("base58xmr: wrong padding");
			}
			res = res.concat(Array.from(block.slice(block.length - blockLen)));
		}
		return Uint8Array.from(res);
	},
};
var BECH_ALPHABET = chain(
	alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"),
	join(""),
);
var POLYMOD_GENERATORS = [
	996825010, 642813549, 513874426, 1027748829, 705979059,
];
function bech32Polymod(pre) {
	const b = pre >> 25;
	let chk = (pre & 33554431) << 5;
	for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
		if (((b >> i) & 1) === 1) chk ^= POLYMOD_GENERATORS[i];
	}
	return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
	const len = prefix.length;
	let chk = 1;
	for (let i = 0; i < len; i++) {
		const c = prefix.charCodeAt(i);
		if (c < 33 || c > 126) throw new Error(`Invalid prefix (${prefix})`);
		chk = bech32Polymod(chk) ^ (c >> 5);
	}
	chk = bech32Polymod(chk);
	for (let i = 0; i < len; i++)
		chk = bech32Polymod(chk) ^ (prefix.charCodeAt(i) & 31);
	for (const v of words) chk = bech32Polymod(chk) ^ v;
	for (let i = 0; i < 6; i++) chk = bech32Polymod(chk);
	chk ^= encodingConst;
	return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
}
function genBech32(encoding) {
	const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
	const _words = radix2(5);
	const fromWords = _words.decode;
	const toWords = _words.encode;
	const fromWordsUnsafe = unsafeWrapper(fromWords);
	function encode(prefix, words, limit = 90) {
		if (typeof prefix !== "string")
			throw new Error(
				`bech32.encode prefix should be string, not ${typeof prefix}`,
			);
		if (!Array.isArray(words) || (words.length && typeof words[0] !== "number"))
			throw new Error(
				`bech32.encode words should be array of numbers, not ${typeof words}`,
			);
		const actualLength = prefix.length + 7 + words.length;
		if (limit !== false && actualLength > limit)
			throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
		prefix = prefix.toLowerCase();
		return `${prefix}1${BECH_ALPHABET.encode(words)}${bechChecksum(prefix, words, ENCODING_CONST)}`;
	}
	function decode(str, limit = 90) {
		if (typeof str !== "string")
			throw new Error(
				`bech32.decode input should be string, not ${typeof str}`,
			);
		if (str.length < 8 || (limit !== false && str.length > limit))
			throw new TypeError(
				`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`,
			);
		const lowered = str.toLowerCase();
		if (str !== lowered && str !== str.toUpperCase())
			throw new Error(`String must be lowercase or uppercase`);
		str = lowered;
		const sepIndex = str.lastIndexOf("1");
		if (sepIndex === 0 || sepIndex === -1)
			throw new Error(
				`Letter "1" must be present between prefix and data only`,
			);
		const prefix = str.slice(0, sepIndex);
		const _words2 = str.slice(sepIndex + 1);
		if (_words2.length < 6)
			throw new Error("Data must be at least 6 characters long");
		const words = BECH_ALPHABET.decode(_words2).slice(0, -6);
		const sum = bechChecksum(prefix, words, ENCODING_CONST);
		if (!_words2.endsWith(sum))
			throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
		return { prefix, words };
	}
	const decodeUnsafe = unsafeWrapper(decode);
	function decodeToBytes(str) {
		const { prefix, words } = decode(str, false);
		return { prefix, words, bytes: fromWords(words) };
	}
	return {
		encode,
		decode,
		decodeToBytes,
		decodeUnsafe,
		fromWords,
		fromWordsUnsafe,
		toWords,
	};
}
var bech32 = genBech32("bech32");
var bech32m = genBech32("bech32m");
var utf8 = {
	encode: (data) => new TextDecoder().decode(data),
	decode: (str) => new TextEncoder().encode(str),
};
var hex = chain(
	radix2(4),
	alphabet("0123456789abcdef"),
	join(""),
	normalize((s) => {
		if (typeof s !== "string" || s.length % 2)
			throw new TypeError(
				`hex.decode: expected string, got ${typeof s} with length ${s.length}`,
			);
		return s.toLowerCase();
	}),
);
var CODERS = {
	utf8,
	hex,
	base16,
	base32,
	base64,
	base64url,
	base58,
	base58xmr,
};
var coderTypeError = `Invalid encoding type. Available types: ${Object.keys(CODERS).join(", ")}`;

// node_modules/@noble/ciphers/esm/_assert.js
function number3(n) {
	if (!Number.isSafeInteger(n) || n < 0)
		throw new Error(`positive integer expected, not ${n}`);
}
function bool2(b) {
	if (typeof b !== "boolean") throw new Error(`boolean expected, not ${b}`);
}
function isBytes(a) {
	return (
		a instanceof Uint8Array ||
		(a != null && typeof a === "object" && a.constructor.name === "Uint8Array")
	);
}
function bytes3(b, ...lengths) {
	if (!isBytes(b)) throw new Error("Uint8Array expected");
	if (lengths.length > 0 && !lengths.includes(b.length))
		throw new Error(
			`Uint8Array expected of length ${lengths}, not of length=${b.length}`,
		);
}
function exists3(instance, checkFinished = true) {
	if (instance.destroyed) throw new Error("Hash instance has been destroyed");
	if (checkFinished && instance.finished)
		throw new Error("Hash#digest() has already been called");
}
function output3(out, instance) {
	bytes3(out);
	const min = instance.outputLen;
	if (out.length < min) {
		throw new Error(
			`digestInto() expects output buffer of length at least ${min}`,
		);
	}
}

// node_modules/@noble/ciphers/esm/utils.js
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
var u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
var u32 = (arr) =>
	new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
var createView3 = (arr) =>
	new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
var isLE3 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE3) throw new Error("Non little-endian hardware is not supported");
function utf8ToBytes4(str) {
	if (typeof str !== "string")
		throw new Error(`string expected, got ${typeof str}`);
	return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes3(data) {
	if (typeof data === "string") data = utf8ToBytes4(data);
	else if (isBytes(data)) data = data.slice();
	else throw new Error(`Uint8Array expected, got ${typeof data}`);
	return data;
}
function checkOpts(defaults, opts) {
	if (opts == null || typeof opts !== "object")
		throw new Error("options must be defined");
	const merged = Object.assign(defaults, opts);
	return merged;
}
function equalBytes2(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}
var wrapCipher = (params, c) => {
	Object.assign(c, params);
	return c;
};
function setBigUint643(view, byteOffset, value, isLE4) {
	if (typeof view.setBigUint64 === "function")
		return view.setBigUint64(byteOffset, value, isLE4);
	const _32n = BigInt(32);
	const _u32_max = BigInt(4294967295);
	const wh = Number((value >> _32n) & _u32_max);
	const wl = Number(value & _u32_max);
	const h = isLE4 ? 4 : 0;
	const l = isLE4 ? 0 : 4;
	view.setUint32(byteOffset + h, wh, isLE4);
	view.setUint32(byteOffset + l, wl, isLE4);
}

// node_modules/@noble/ciphers/esm/_polyval.js
var BLOCK_SIZE = 16;
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var ZEROS32 = u32(ZEROS16);
var POLY = 225;
var mul2 = (s0, s1, s2, s3) => {
	const hiBit = s3 & 1;
	return {
		s3: (s2 << 31) | (s3 >>> 1),
		s2: (s1 << 31) | (s2 >>> 1),
		s1: (s0 << 31) | (s1 >>> 1),
		s0: (s0 >>> 1) ^ ((POLY << 24) & -(hiBit & 1)),
	};
};
var swapLE = (n) =>
	(((n >>> 0) & 255) << 24) |
	(((n >>> 8) & 255) << 16) |
	(((n >>> 16) & 255) << 8) |
	((n >>> 24) & 255) |
	0;
function _toGHASHKey(k) {
	k.reverse();
	const hiBit = k[15] & 1;
	let carry = 0;
	for (let i = 0; i < k.length; i++) {
		const t = k[i];
		k[i] = (t >>> 1) | carry;
		carry = (t & 1) << 7;
	}
	k[0] ^= -hiBit & 225;
	return k;
}
var estimateWindow = (bytes4) => {
	if (bytes4 > 64 * 1024) return 8;
	if (bytes4 > 1024) return 4;
	return 2;
};

class GHASH {
	constructor(key, expectedLength) {
		this.blockLen = BLOCK_SIZE;
		this.outputLen = BLOCK_SIZE;
		this.s0 = 0;
		this.s1 = 0;
		this.s2 = 0;
		this.s3 = 0;
		this.finished = false;
		key = toBytes3(key);
		bytes3(key, 16);
		const kView = createView3(key);
		let k0 = kView.getUint32(0, false);
		let k1 = kView.getUint32(4, false);
		let k2 = kView.getUint32(8, false);
		let k3 = kView.getUint32(12, false);
		const doubles = [];
		for (let i = 0; i < 128; i++) {
			doubles.push({
				s0: swapLE(k0),
				s1: swapLE(k1),
				s2: swapLE(k2),
				s3: swapLE(k3),
			});
			({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
		}
		const W = estimateWindow(expectedLength || 1024);
		if (![1, 2, 4, 8].includes(W))
			throw new Error(`ghash: wrong window size=${W}, should be 2, 4 or 8`);
		this.W = W;
		const bits = 128;
		const windows = bits / W;
		const windowSize = (this.windowSize = 2 ** W);
		const items = [];
		for (let w = 0; w < windows; w++) {
			for (let byte = 0; byte < windowSize; byte++) {
				let s0 = 0,
					s1 = 0,
					s2 = 0,
					s3 = 0;
				for (let j = 0; j < W; j++) {
					const bit = (byte >>> (W - j - 1)) & 1;
					if (!bit) continue;
					const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
					(s0 ^= d0), (s1 ^= d1), (s2 ^= d2), (s3 ^= d3);
				}
				items.push({ s0, s1, s2, s3 });
			}
		}
		this.t = items;
	}
	_updateBlock(s0, s1, s2, s3) {
		(s0 ^= this.s0), (s1 ^= this.s1), (s2 ^= this.s2), (s3 ^= this.s3);
		const { W, t, windowSize } = this;
		let o0 = 0,
			o1 = 0,
			o2 = 0,
			o3 = 0;
		const mask = (1 << W) - 1;
		let w = 0;
		for (const num of [s0, s1, s2, s3]) {
			for (let bytePos = 0; bytePos < 4; bytePos++) {
				const byte = (num >>> (8 * bytePos)) & 255;
				for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
					const bit = (byte >>> (W * bitPos)) & mask;
					const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
					(o0 ^= e0), (o1 ^= e1), (o2 ^= e2), (o3 ^= e3);
					w += 1;
				}
			}
		}
		this.s0 = o0;
		this.s1 = o1;
		this.s2 = o2;
		this.s3 = o3;
	}
	update(data) {
		data = toBytes3(data);
		exists3(this);
		const b32 = u32(data);
		const blocks = Math.floor(data.length / BLOCK_SIZE);
		const left = data.length % BLOCK_SIZE;
		for (let i = 0; i < blocks; i++) {
			this._updateBlock(
				b32[i * 4 + 0],
				b32[i * 4 + 1],
				b32[i * 4 + 2],
				b32[i * 4 + 3],
			);
		}
		if (left) {
			ZEROS16.set(data.subarray(blocks * BLOCK_SIZE));
			this._updateBlock(ZEROS32[0], ZEROS32[1], ZEROS32[2], ZEROS32[3]);
			ZEROS32.fill(0);
		}
		return this;
	}
	destroy() {
		const { t } = this;
		for (const elm of t) {
			(elm.s0 = 0), (elm.s1 = 0), (elm.s2 = 0), (elm.s3 = 0);
		}
	}
	digestInto(out) {
		exists3(this);
		output3(out, this);
		this.finished = true;
		const { s0, s1, s2, s3 } = this;
		const o32 = u32(out);
		o32[0] = s0;
		o32[1] = s1;
		o32[2] = s2;
		o32[3] = s3;
		return out;
	}
	digest() {
		const res = new Uint8Array(BLOCK_SIZE);
		this.digestInto(res);
		this.destroy();
		return res;
	}
}

class Polyval extends GHASH {
	constructor(key, expectedLength) {
		key = toBytes3(key);
		const ghKey = _toGHASHKey(key.slice());
		super(ghKey, expectedLength);
		ghKey.fill(0);
	}
	update(data) {
		data = toBytes3(data);
		exists3(this);
		const b32 = u32(data);
		const left = data.length % BLOCK_SIZE;
		const blocks = Math.floor(data.length / BLOCK_SIZE);
		for (let i = 0; i < blocks; i++) {
			this._updateBlock(
				swapLE(b32[i * 4 + 3]),
				swapLE(b32[i * 4 + 2]),
				swapLE(b32[i * 4 + 1]),
				swapLE(b32[i * 4 + 0]),
			);
		}
		if (left) {
			ZEROS16.set(data.subarray(blocks * BLOCK_SIZE));
			this._updateBlock(
				swapLE(ZEROS32[3]),
				swapLE(ZEROS32[2]),
				swapLE(ZEROS32[1]),
				swapLE(ZEROS32[0]),
			);
			ZEROS32.fill(0);
		}
		return this;
	}
	digestInto(out) {
		exists3(this);
		output3(out, this);
		this.finished = true;
		const { s0, s1, s2, s3 } = this;
		const o32 = u32(out);
		o32[0] = s0;
		o32[1] = s1;
		o32[2] = s2;
		o32[3] = s3;
		return out.reverse();
	}
}
function wrapConstructorWithKey(hashCons) {
	const hashC = (msg, key) =>
		hashCons(key, msg.length).update(toBytes3(msg)).digest();
	const tmp = hashCons(new Uint8Array(16), 0);
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = (key, expectedLength) => hashCons(key, expectedLength);
	return hashC;
}
var ghash = wrapConstructorWithKey(
	(key, expectedLength) => new GHASH(key, expectedLength),
);
var polyval = wrapConstructorWithKey(
	(key, expectedLength) => new Polyval(key, expectedLength),
);

// node_modules/@noble/ciphers/esm/aes.js
var BLOCK_SIZE2 = 16;
var BLOCK_SIZE32 = 4;
var EMPTY_BLOCK = new Uint8Array(BLOCK_SIZE2);
var POLY2 = 283;
function mul22(n) {
	return (n << 1) ^ (POLY2 & -(n >> 7));
}
function mul(a, b) {
	let res = 0;
	for (; b > 0; b >>= 1) {
		res ^= a & -(b & 1);
		a = mul22(a);
	}
	return res;
}
var sbox = /* @__PURE__ */ (() => {
	const t = new Uint8Array(256);
	for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x)) t[i] = x;
	const box = new Uint8Array(256);
	box[0] = 99;
	for (let i = 0; i < 255; i++) {
		let x = t[255 - i];
		x |= x << 8;
		box[t[i]] = (x ^ (x >> 4) ^ (x >> 5) ^ (x >> 6) ^ (x >> 7) ^ 99) & 255;
	}
	return box;
})();
var invSbox = /* @__PURE__ */ sbox.map((_, j) => sbox.indexOf(j));
var rotr32_8 = (n) => (n << 24) | (n >>> 8);
var rotl32_8 = (n) => (n << 8) | (n >>> 24);
function genTtable(sbox2, fn) {
	if (sbox2.length !== 256) throw new Error("Wrong sbox length");
	const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
	const T1 = T0.map(rotl32_8);
	const T2 = T1.map(rotl32_8);
	const T3 = T2.map(rotl32_8);
	const T01 = new Uint32Array(256 * 256);
	const T23 = new Uint32Array(256 * 256);
	const sbox22 = new Uint16Array(256 * 256);
	for (let i = 0; i < 256; i++) {
		for (let j = 0; j < 256; j++) {
			const idx = i * 256 + j;
			T01[idx] = T0[i] ^ T1[j];
			T23[idx] = T2[i] ^ T3[j];
			sbox22[idx] = (sbox2[i] << 8) | sbox2[j];
		}
	}
	return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
var tableEncoding = /* @__PURE__ */ genTtable(
	sbox,
	(s) => (mul(s, 3) << 24) | (s << 16) | (s << 8) | mul(s, 2),
);
var tableDecoding = /* @__PURE__ */ genTtable(
	invSbox,
	(s) =>
		(mul(s, 11) << 24) | (mul(s, 13) << 16) | (mul(s, 9) << 8) | mul(s, 14),
);
var xPowers = /* @__PURE__ */ (() => {
	const p = new Uint8Array(16);
	for (let i = 0, x = 1; i < 16; i++, x = mul22(x)) p[i] = x;
	return p;
})();
function expandKeyLE(key) {
	bytes3(key);
	const len = key.length;
	if (![16, 24, 32].includes(len))
		throw new Error(`aes: wrong key size: should be 16, 24 or 32, got: ${len}`);
	const { sbox2 } = tableEncoding;
	const k32 = u32(key);
	const Nk = k32.length;
	const subByte = (n) => applySbox(sbox2, n, n, n, n);
	const xk = new Uint32Array(len + 28);
	xk.set(k32);
	for (let i = Nk; i < xk.length; i++) {
		let t = xk[i - 1];
		if (i % Nk === 0) t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
		else if (Nk > 6 && i % Nk === 4) t = subByte(t);
		xk[i] = xk[i - Nk] ^ t;
	}
	return xk;
}
function expandKeyDecLE(key) {
	const encKey = expandKeyLE(key);
	const xk = encKey.slice();
	const Nk = encKey.length;
	const { sbox2 } = tableEncoding;
	const { T0, T1, T2, T3 } = tableDecoding;
	for (let i = 0; i < Nk; i += 4) {
		for (let j = 0; j < 4; j++) xk[i + j] = encKey[Nk - i - 4 + j];
	}
	encKey.fill(0);
	for (let i = 4; i < Nk - 4; i++) {
		const x = xk[i];
		const w = applySbox(sbox2, x, x, x, x);
		xk[i] =
			T0[w & 255] ^ T1[(w >>> 8) & 255] ^ T2[(w >>> 16) & 255] ^ T3[w >>> 24];
	}
	return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
	return (
		T01[((s0 << 8) & 65280) | ((s1 >>> 8) & 255)] ^
		T23[((s2 >>> 8) & 65280) | ((s3 >>> 24) & 255)]
	);
}
function applySbox(sbox2, s0, s1, s2, s3) {
	return (
		sbox2[(s0 & 255) | (s1 & 65280)] |
		(sbox2[((s2 >>> 16) & 255) | ((s3 >>> 16) & 65280)] << 16)
	);
}
function encrypt(xk, s0, s1, s2, s3) {
	const { sbox2, T01, T23 } = tableEncoding;
	let k = 0;
	(s0 ^= xk[k++]), (s1 ^= xk[k++]), (s2 ^= xk[k++]), (s3 ^= xk[k++]);
	const rounds = xk.length / 4 - 2;
	for (let i = 0; i < rounds; i++) {
		const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
		const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
		const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
		const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
		(s0 = t02), (s1 = t12), (s2 = t22), (s3 = t32);
	}
	const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
	const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
	const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
	const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
	return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function decrypt(xk, s0, s1, s2, s3) {
	const { sbox2, T01, T23 } = tableDecoding;
	let k = 0;
	(s0 ^= xk[k++]), (s1 ^= xk[k++]), (s2 ^= xk[k++]), (s3 ^= xk[k++]);
	const rounds = xk.length / 4 - 2;
	for (let i = 0; i < rounds; i++) {
		const t02 = xk[k++] ^ apply0123(T01, T23, s0, s3, s2, s1);
		const t12 = xk[k++] ^ apply0123(T01, T23, s1, s0, s3, s2);
		const t22 = xk[k++] ^ apply0123(T01, T23, s2, s1, s0, s3);
		const t32 = xk[k++] ^ apply0123(T01, T23, s3, s2, s1, s0);
		(s0 = t02), (s1 = t12), (s2 = t22), (s3 = t32);
	}
	const t0 = xk[k++] ^ applySbox(sbox2, s0, s3, s2, s1);
	const t1 = xk[k++] ^ applySbox(sbox2, s1, s0, s3, s2);
	const t2 = xk[k++] ^ applySbox(sbox2, s2, s1, s0, s3);
	const t3 = xk[k++] ^ applySbox(sbox2, s3, s2, s1, s0);
	return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function getDst(len, dst) {
	if (!dst) return new Uint8Array(len);
	bytes3(dst);
	if (dst.length < len)
		throw new Error(
			`aes: wrong destination length, expected at least ${len}, got: ${dst.length}`,
		);
	return dst;
}
function ctrCounter(xk, nonce, src, dst) {
	bytes3(nonce, BLOCK_SIZE2);
	bytes3(src);
	const srcLen = src.length;
	dst = getDst(srcLen, dst);
	const ctr = nonce;
	const c32 = u32(ctr);
	let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
	const src32 = u32(src);
	const dst32 = u32(dst);
	for (let i = 0; i + 4 <= src32.length; i += 4) {
		dst32[i + 0] = src32[i + 0] ^ s0;
		dst32[i + 1] = src32[i + 1] ^ s1;
		dst32[i + 2] = src32[i + 2] ^ s2;
		dst32[i + 3] = src32[i + 3] ^ s3;
		let carry = 1;
		for (let i2 = ctr.length - 1; i2 >= 0; i2--) {
			carry = (carry + (ctr[i2] & 255)) | 0;
			ctr[i2] = carry & 255;
			carry >>>= 8;
		}
		({ s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
	}
	const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
	if (start < srcLen) {
		const b32 = new Uint32Array([s0, s1, s2, s3]);
		const buf = u8(b32);
		for (let i = start, pos = 0; i < srcLen; i++, pos++)
			dst[i] = src[i] ^ buf[pos];
	}
	return dst;
}
function ctr32(xk, isLE4, nonce, src, dst) {
	bytes3(nonce, BLOCK_SIZE2);
	bytes3(src);
	dst = getDst(src.length, dst);
	const ctr = nonce;
	const c32 = u32(ctr);
	const view = createView3(ctr);
	const src32 = u32(src);
	const dst32 = u32(dst);
	const ctrPos = isLE4 ? 0 : 12;
	const srcLen = src.length;
	let ctrNum = view.getUint32(ctrPos, isLE4);
	let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
	for (let i = 0; i + 4 <= src32.length; i += 4) {
		dst32[i + 0] = src32[i + 0] ^ s0;
		dst32[i + 1] = src32[i + 1] ^ s1;
		dst32[i + 2] = src32[i + 2] ^ s2;
		dst32[i + 3] = src32[i + 3] ^ s3;
		ctrNum = (ctrNum + 1) >>> 0;
		view.setUint32(ctrPos, ctrNum, isLE4);
		({ s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
	}
	const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
	if (start < srcLen) {
		const b32 = new Uint32Array([s0, s1, s2, s3]);
		const buf = u8(b32);
		for (let i = start, pos = 0; i < srcLen; i++, pos++)
			dst[i] = src[i] ^ buf[pos];
	}
	return dst;
}
var ctr = wrapCipher(
	{ blockSize: 16, nonceLength: 16 },
	function ctr2(key, nonce) {
		bytes3(key);
		bytes3(nonce, BLOCK_SIZE2);
		function processCtr(buf, dst) {
			const xk = expandKeyLE(key);
			const n = nonce.slice();
			const out = ctrCounter(xk, n, buf, dst);
			xk.fill(0);
			n.fill(0);
			return out;
		}
		return {
			encrypt: (plaintext, dst) => processCtr(plaintext, dst),
			decrypt: (ciphertext, dst) => processCtr(ciphertext, dst),
		};
	},
);
function validateBlockDecrypt(data) {
	bytes3(data);
	if (data.length % BLOCK_SIZE2 !== 0) {
		throw new Error(
			`aes/(cbc-ecb).decrypt ciphertext should consist of blocks with size ${BLOCK_SIZE2}`,
		);
	}
}
function validateBlockEncrypt(plaintext, pcks5, dst) {
	let outLen = plaintext.length;
	const remaining = outLen % BLOCK_SIZE2;
	if (!pcks5 && remaining !== 0)
		throw new Error("aec/(cbc-ecb): unpadded plaintext with disabled padding");
	const b = u32(plaintext);
	if (pcks5) {
		let left = BLOCK_SIZE2 - remaining;
		if (!left) left = BLOCK_SIZE2;
		outLen = outLen + left;
	}
	const out = getDst(outLen, dst);
	const o = u32(out);
	return { b, o, out };
}
function validatePCKS(data, pcks5) {
	if (!pcks5) return data;
	const len = data.length;
	if (!len) throw new Error(`aes/pcks5: empty ciphertext not allowed`);
	const lastByte = data[len - 1];
	if (lastByte <= 0 || lastByte > 16)
		throw new Error(`aes/pcks5: wrong padding byte: ${lastByte}`);
	const out = data.subarray(0, -lastByte);
	for (let i = 0; i < lastByte; i++)
		if (data[len - i - 1] !== lastByte)
			throw new Error(`aes/pcks5: wrong padding`);
	return out;
}
function padPCKS(left) {
	const tmp = new Uint8Array(16);
	const tmp32 = u32(tmp);
	tmp.set(left);
	const paddingByte = BLOCK_SIZE2 - left.length;
	for (let i = BLOCK_SIZE2 - paddingByte; i < BLOCK_SIZE2; i++)
		tmp[i] = paddingByte;
	return tmp32;
}
var ecb = wrapCipher({ blockSize: 16 }, function ecb2(key, opts = {}) {
	bytes3(key);
	const pcks5 = !opts.disablePadding;
	return {
		encrypt: (plaintext, dst) => {
			bytes3(plaintext);
			const { b, o, out: _out } = validateBlockEncrypt(plaintext, pcks5, dst);
			const xk = expandKeyLE(key);
			let i = 0;
			while (i + 4 <= b.length) {
				const { s0, s1, s2, s3 } = encrypt(
					xk,
					b[i + 0],
					b[i + 1],
					b[i + 2],
					b[i + 3],
				);
				(o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3);
			}
			if (pcks5) {
				const tmp32 = padPCKS(plaintext.subarray(i * 4));
				const { s0, s1, s2, s3 } = encrypt(
					xk,
					tmp32[0],
					tmp32[1],
					tmp32[2],
					tmp32[3],
				);
				(o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3);
			}
			xk.fill(0);
			return _out;
		},
		decrypt: (ciphertext, dst) => {
			validateBlockDecrypt(ciphertext);
			const xk = expandKeyDecLE(key);
			const out = getDst(ciphertext.length, dst);
			const b = u32(ciphertext);
			const o = u32(out);
			for (let i = 0; i + 4 <= b.length; ) {
				const { s0, s1, s2, s3 } = decrypt(
					xk,
					b[i + 0],
					b[i + 1],
					b[i + 2],
					b[i + 3],
				);
				(o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3);
			}
			xk.fill(0);
			return validatePCKS(out, pcks5);
		},
	};
});
var cbc = wrapCipher(
	{ blockSize: 16, nonceLength: 16 },
	function cbc2(key, iv, opts = {}) {
		bytes3(key);
		bytes3(iv, 16);
		const pcks5 = !opts.disablePadding;
		return {
			encrypt: (plaintext, dst) => {
				const xk = expandKeyLE(key);
				const { b, o, out: _out } = validateBlockEncrypt(plaintext, pcks5, dst);
				const n32 = u32(iv);
				let s0 = n32[0],
					s1 = n32[1],
					s2 = n32[2],
					s3 = n32[3];
				let i = 0;
				while (i + 4 <= b.length) {
					(s0 ^= b[i + 0]),
						(s1 ^= b[i + 1]),
						(s2 ^= b[i + 2]),
						(s3 ^= b[i + 3]);
					({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
					(o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3);
				}
				if (pcks5) {
					const tmp32 = padPCKS(plaintext.subarray(i * 4));
					(s0 ^= tmp32[0]),
						(s1 ^= tmp32[1]),
						(s2 ^= tmp32[2]),
						(s3 ^= tmp32[3]);
					({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
					(o[i++] = s0), (o[i++] = s1), (o[i++] = s2), (o[i++] = s3);
				}
				xk.fill(0);
				return _out;
			},
			decrypt: (ciphertext, dst) => {
				validateBlockDecrypt(ciphertext);
				const xk = expandKeyDecLE(key);
				const n32 = u32(iv);
				const out = getDst(ciphertext.length, dst);
				const b = u32(ciphertext);
				const o = u32(out);
				let s0 = n32[0],
					s1 = n32[1],
					s2 = n32[2],
					s3 = n32[3];
				for (let i = 0; i + 4 <= b.length; ) {
					const ps0 = s0,
						ps1 = s1,
						ps2 = s2,
						ps3 = s3;
					(s0 = b[i + 0]), (s1 = b[i + 1]), (s2 = b[i + 2]), (s3 = b[i + 3]);
					const {
						s0: o0,
						s1: o1,
						s2: o2,
						s3: o3,
					} = decrypt(xk, s0, s1, s2, s3);
					(o[i++] = o0 ^ ps0),
						(o[i++] = o1 ^ ps1),
						(o[i++] = o2 ^ ps2),
						(o[i++] = o3 ^ ps3);
				}
				xk.fill(0);
				return validatePCKS(out, pcks5);
			},
		};
	},
);
var cfb = wrapCipher(
	{ blockSize: 16, nonceLength: 16 },
	function cfb2(key, iv) {
		bytes3(key);
		bytes3(iv, 16);
		function processCfb(src, isEncrypt, dst) {
			const xk = expandKeyLE(key);
			const srcLen = src.length;
			dst = getDst(srcLen, dst);
			const src32 = u32(src);
			const dst32 = u32(dst);
			const next32 = isEncrypt ? dst32 : src32;
			const n32 = u32(iv);
			let s0 = n32[0],
				s1 = n32[1],
				s2 = n32[2],
				s3 = n32[3];
			for (let i = 0; i + 4 <= src32.length; ) {
				const { s0: e0, s1: e1, s2: e2, s3: e3 } = encrypt(xk, s0, s1, s2, s3);
				dst32[i + 0] = src32[i + 0] ^ e0;
				dst32[i + 1] = src32[i + 1] ^ e1;
				dst32[i + 2] = src32[i + 2] ^ e2;
				dst32[i + 3] = src32[i + 3] ^ e3;
				(s0 = next32[i++]),
					(s1 = next32[i++]),
					(s2 = next32[i++]),
					(s3 = next32[i++]);
			}
			const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
			if (start < srcLen) {
				({ s0, s1, s2, s3 } = encrypt(xk, s0, s1, s2, s3));
				const buf = u8(new Uint32Array([s0, s1, s2, s3]));
				for (let i = start, pos = 0; i < srcLen; i++, pos++)
					dst[i] = src[i] ^ buf[pos];
				buf.fill(0);
			}
			xk.fill(0);
			return dst;
		}
		return {
			encrypt: (plaintext, dst) => processCfb(plaintext, true, dst),
			decrypt: (ciphertext, dst) => processCfb(ciphertext, false, dst),
		};
	},
);
function computeTag(fn, isLE4, key, data, AAD) {
	const h = fn.create(key, data.length + (AAD?.length || 0));
	if (AAD) h.update(AAD);
	h.update(data);
	const num = new Uint8Array(16);
	const view = createView3(num);
	if (AAD) setBigUint643(view, 0, BigInt(AAD.length * 8), isLE4);
	setBigUint643(view, 8, BigInt(data.length * 8), isLE4);
	h.update(num);
	return h.digest();
}
var gcm = wrapCipher(
	{ blockSize: 16, nonceLength: 12, tagLength: 16 },
	function gcm2(key, nonce, AAD) {
		bytes3(nonce);
		if (nonce.length === 0) throw new Error("aes/gcm: empty nonce");
		const tagLength = 16;
		function _computeTag(authKey, tagMask, data) {
			const tag = computeTag(ghash, false, authKey, data, AAD);
			for (let i = 0; i < tagMask.length; i++) tag[i] ^= tagMask[i];
			return tag;
		}
		function deriveKeys() {
			const xk = expandKeyLE(key);
			const authKey = EMPTY_BLOCK.slice();
			const counter = EMPTY_BLOCK.slice();
			ctr32(xk, false, counter, counter, authKey);
			if (nonce.length === 12) {
				counter.set(nonce);
			} else {
				const nonceLen = EMPTY_BLOCK.slice();
				const view = createView3(nonceLen);
				setBigUint643(view, 8, BigInt(nonce.length * 8), false);
				ghash
					.create(authKey)
					.update(nonce)
					.update(nonceLen)
					.digestInto(counter);
			}
			const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
			return { xk, authKey, counter, tagMask };
		}
		return {
			encrypt: (plaintext) => {
				bytes3(plaintext);
				const { xk, authKey, counter, tagMask } = deriveKeys();
				const out = new Uint8Array(plaintext.length + tagLength);
				ctr32(xk, false, counter, plaintext, out);
				const tag = _computeTag(
					authKey,
					tagMask,
					out.subarray(0, out.length - tagLength),
				);
				out.set(tag, plaintext.length);
				xk.fill(0);
				return out;
			},
			decrypt: (ciphertext) => {
				bytes3(ciphertext);
				if (ciphertext.length < tagLength)
					throw new Error(
						`aes/gcm: ciphertext less than tagLen (${tagLength})`,
					);
				const { xk, authKey, counter, tagMask } = deriveKeys();
				const data = ciphertext.subarray(0, -tagLength);
				const passedTag = ciphertext.subarray(-tagLength);
				const tag = _computeTag(authKey, tagMask, data);
				if (!equalBytes2(tag, passedTag))
					throw new Error("aes/gcm: invalid ghash tag");
				const out = ctr32(xk, false, counter, data);
				authKey.fill(0);
				tagMask.fill(0);
				xk.fill(0);
				return out;
			},
		};
	},
);
var limit = (name, min, max) => (value) => {
	if (!Number.isSafeInteger(value) || min > value || value > max)
		throw new Error(
			`${name}: invalid value=${value}, must be [${min}..${max}]`,
		);
};
var siv = wrapCipher(
	{ blockSize: 16, nonceLength: 12, tagLength: 16 },
	function siv2(key, nonce, AAD) {
		const tagLength = 16;
		const AAD_LIMIT = limit("AAD", 0, 2 ** 36);
		const PLAIN_LIMIT = limit("plaintext", 0, 2 ** 36);
		const NONCE_LIMIT = limit("nonce", 12, 12);
		const CIPHER_LIMIT = limit("ciphertext", 16, 2 ** 36 + 16);
		bytes3(nonce);
		NONCE_LIMIT(nonce.length);
		if (AAD) {
			bytes3(AAD);
			AAD_LIMIT(AAD.length);
		}
		function deriveKeys() {
			const len = key.length;
			if (len !== 16 && len !== 24 && len !== 32)
				throw new Error(
					`key length must be 16, 24 or 32 bytes, got: ${len} bytes`,
				);
			const xk = expandKeyLE(key);
			const encKey = new Uint8Array(len);
			const authKey = new Uint8Array(16);
			const n32 = u32(nonce);
			let s0 = 0,
				s1 = n32[0],
				s2 = n32[1],
				s3 = n32[2];
			let counter = 0;
			for (const derivedKey of [authKey, encKey].map(u32)) {
				const d32 = u32(derivedKey);
				for (let i = 0; i < d32.length; i += 2) {
					const { s0: o0, s1: o1 } = encrypt(xk, s0, s1, s2, s3);
					d32[i + 0] = o0;
					d32[i + 1] = o1;
					s0 = ++counter;
				}
			}
			xk.fill(0);
			return { authKey, encKey: expandKeyLE(encKey) };
		}
		function _computeTag(encKey, authKey, data) {
			const tag = computeTag(polyval, true, authKey, data, AAD);
			for (let i = 0; i < 12; i++) tag[i] ^= nonce[i];
			tag[15] &= 127;
			const t32 = u32(tag);
			let s0 = t32[0],
				s1 = t32[1],
				s2 = t32[2],
				s3 = t32[3];
			({ s0, s1, s2, s3 } = encrypt(encKey, s0, s1, s2, s3));
			(t32[0] = s0), (t32[1] = s1), (t32[2] = s2), (t32[3] = s3);
			return tag;
		}
		function processSiv(encKey, tag, input) {
			const block = tag.slice();
			block[15] |= 128;
			return ctr32(encKey, true, block, input);
		}
		return {
			encrypt: (plaintext) => {
				bytes3(plaintext);
				PLAIN_LIMIT(plaintext.length);
				const { encKey, authKey } = deriveKeys();
				const tag = _computeTag(encKey, authKey, plaintext);
				const out = new Uint8Array(plaintext.length + tagLength);
				out.set(tag, plaintext.length);
				out.set(processSiv(encKey, tag, plaintext));
				encKey.fill(0);
				authKey.fill(0);
				return out;
			},
			decrypt: (ciphertext) => {
				bytes3(ciphertext);
				CIPHER_LIMIT(ciphertext.length);
				const tag = ciphertext.subarray(-tagLength);
				const { encKey, authKey } = deriveKeys();
				const plaintext = processSiv(
					encKey,
					tag,
					ciphertext.subarray(0, -tagLength),
				);
				const expectedTag = _computeTag(encKey, authKey, plaintext);
				encKey.fill(0);
				authKey.fill(0);
				if (!equalBytes2(tag, expectedTag))
					throw new Error("invalid polyval tag");
				return plaintext;
			},
		};
	},
);

// node_modules/@noble/ciphers/esm/_poly1305.js
var u8to16 = (a, i) => (a[i++] & 255) | ((a[i++] & 255) << 8);

class Poly1305 {
	constructor(key) {
		this.blockLen = 16;
		this.outputLen = 16;
		this.buffer = new Uint8Array(16);
		this.r = new Uint16Array(10);
		this.h = new Uint16Array(10);
		this.pad = new Uint16Array(8);
		this.pos = 0;
		this.finished = false;
		key = toBytes3(key);
		bytes3(key, 32);
		const t0 = u8to16(key, 0);
		const t1 = u8to16(key, 2);
		const t2 = u8to16(key, 4);
		const t3 = u8to16(key, 6);
		const t4 = u8to16(key, 8);
		const t5 = u8to16(key, 10);
		const t6 = u8to16(key, 12);
		const t7 = u8to16(key, 14);
		this.r[0] = t0 & 8191;
		this.r[1] = ((t0 >>> 13) | (t1 << 3)) & 8191;
		this.r[2] = ((t1 >>> 10) | (t2 << 6)) & 7939;
		this.r[3] = ((t2 >>> 7) | (t3 << 9)) & 8191;
		this.r[4] = ((t3 >>> 4) | (t4 << 12)) & 255;
		this.r[5] = (t4 >>> 1) & 8190;
		this.r[6] = ((t4 >>> 14) | (t5 << 2)) & 8191;
		this.r[7] = ((t5 >>> 11) | (t6 << 5)) & 8065;
		this.r[8] = ((t6 >>> 8) | (t7 << 8)) & 8191;
		this.r[9] = (t7 >>> 5) & 127;
		for (let i = 0; i < 8; i++) this.pad[i] = u8to16(key, 16 + 2 * i);
	}
	process(data, offset, isLast = false) {
		const hibit = isLast ? 0 : 1 << 11;
		const { h, r } = this;
		const r0 = r[0];
		const r1 = r[1];
		const r2 = r[2];
		const r3 = r[3];
		const r4 = r[4];
		const r5 = r[5];
		const r6 = r[6];
		const r7 = r[7];
		const r8 = r[8];
		const r9 = r[9];
		const t0 = u8to16(data, offset + 0);
		const t1 = u8to16(data, offset + 2);
		const t2 = u8to16(data, offset + 4);
		const t3 = u8to16(data, offset + 6);
		const t4 = u8to16(data, offset + 8);
		const t5 = u8to16(data, offset + 10);
		const t6 = u8to16(data, offset + 12);
		const t7 = u8to16(data, offset + 14);
		const h0 = h[0] + (t0 & 8191);
		const h1 = h[1] + (((t0 >>> 13) | (t1 << 3)) & 8191);
		const h2 = h[2] + (((t1 >>> 10) | (t2 << 6)) & 8191);
		const h3 = h[3] + (((t2 >>> 7) | (t3 << 9)) & 8191);
		const h4 = h[4] + (((t3 >>> 4) | (t4 << 12)) & 8191);
		const h5 = h[5] + ((t4 >>> 1) & 8191);
		const h6 = h[6] + (((t4 >>> 14) | (t5 << 2)) & 8191);
		const h7 = h[7] + (((t5 >>> 11) | (t6 << 5)) & 8191);
		const h8 = h[8] + (((t6 >>> 8) | (t7 << 8)) & 8191);
		const h9 = h[9] + ((t7 >>> 5) | hibit);
		let c = 0;
		let d0 =
			c +
			h0 * r0 +
			h1 * (5 * r9) +
			h2 * (5 * r8) +
			h3 * (5 * r7) +
			h4 * (5 * r6);
		c = d0 >>> 13;
		d0 &= 8191;
		d0 +=
			h5 * (5 * r5) +
			h6 * (5 * r4) +
			h7 * (5 * r3) +
			h8 * (5 * r2) +
			h9 * (5 * r1);
		c += d0 >>> 13;
		d0 &= 8191;
		let d1 =
			c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
		c = d1 >>> 13;
		d1 &= 8191;
		d1 +=
			h5 * (5 * r6) +
			h6 * (5 * r5) +
			h7 * (5 * r4) +
			h8 * (5 * r3) +
			h9 * (5 * r2);
		c += d1 >>> 13;
		d1 &= 8191;
		let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
		c = d2 >>> 13;
		d2 &= 8191;
		d2 +=
			h5 * (5 * r7) +
			h6 * (5 * r6) +
			h7 * (5 * r5) +
			h8 * (5 * r4) +
			h9 * (5 * r3);
		c += d2 >>> 13;
		d2 &= 8191;
		let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
		c = d3 >>> 13;
		d3 &= 8191;
		d3 +=
			h5 * (5 * r8) +
			h6 * (5 * r7) +
			h7 * (5 * r6) +
			h8 * (5 * r5) +
			h9 * (5 * r4);
		c += d3 >>> 13;
		d3 &= 8191;
		let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
		c = d4 >>> 13;
		d4 &= 8191;
		d4 +=
			h5 * (5 * r9) +
			h6 * (5 * r8) +
			h7 * (5 * r7) +
			h8 * (5 * r6) +
			h9 * (5 * r5);
		c += d4 >>> 13;
		d4 &= 8191;
		let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
		c = d5 >>> 13;
		d5 &= 8191;
		d5 +=
			h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
		c += d5 >>> 13;
		d5 &= 8191;
		let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
		c = d6 >>> 13;
		d6 &= 8191;
		d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
		c += d6 >>> 13;
		d6 &= 8191;
		let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
		c = d7 >>> 13;
		d7 &= 8191;
		d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
		c += d7 >>> 13;
		d7 &= 8191;
		let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
		c = d8 >>> 13;
		d8 &= 8191;
		d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
		c += d8 >>> 13;
		d8 &= 8191;
		let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
		c = d9 >>> 13;
		d9 &= 8191;
		d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
		c += d9 >>> 13;
		d9 &= 8191;
		c = ((c << 2) + c) | 0;
		c = (c + d0) | 0;
		d0 = c & 8191;
		c = c >>> 13;
		d1 += c;
		h[0] = d0;
		h[1] = d1;
		h[2] = d2;
		h[3] = d3;
		h[4] = d4;
		h[5] = d5;
		h[6] = d6;
		h[7] = d7;
		h[8] = d8;
		h[9] = d9;
	}
	finalize() {
		const { h, pad } = this;
		const g = new Uint16Array(10);
		let c = h[1] >>> 13;
		h[1] &= 8191;
		for (let i = 2; i < 10; i++) {
			h[i] += c;
			c = h[i] >>> 13;
			h[i] &= 8191;
		}
		h[0] += c * 5;
		c = h[0] >>> 13;
		h[0] &= 8191;
		h[1] += c;
		c = h[1] >>> 13;
		h[1] &= 8191;
		h[2] += c;
		g[0] = h[0] + 5;
		c = g[0] >>> 13;
		g[0] &= 8191;
		for (let i = 1; i < 10; i++) {
			g[i] = h[i] + c;
			c = g[i] >>> 13;
			g[i] &= 8191;
		}
		g[9] -= 1 << 13;
		let mask = (c ^ 1) - 1;
		for (let i = 0; i < 10; i++) g[i] &= mask;
		mask = ~mask;
		for (let i = 0; i < 10; i++) h[i] = (h[i] & mask) | g[i];
		h[0] = (h[0] | (h[1] << 13)) & 65535;
		h[1] = ((h[1] >>> 3) | (h[2] << 10)) & 65535;
		h[2] = ((h[2] >>> 6) | (h[3] << 7)) & 65535;
		h[3] = ((h[3] >>> 9) | (h[4] << 4)) & 65535;
		h[4] = ((h[4] >>> 12) | (h[5] << 1) | (h[6] << 14)) & 65535;
		h[5] = ((h[6] >>> 2) | (h[7] << 11)) & 65535;
		h[6] = ((h[7] >>> 5) | (h[8] << 8)) & 65535;
		h[7] = ((h[8] >>> 8) | (h[9] << 5)) & 65535;
		let f = h[0] + pad[0];
		h[0] = f & 65535;
		for (let i = 1; i < 8; i++) {
			f = (((h[i] + pad[i]) | 0) + (f >>> 16)) | 0;
			h[i] = f & 65535;
		}
	}
	update(data) {
		exists3(this);
		const { buffer, blockLen } = this;
		data = toBytes3(data);
		const len = data.length;
		for (let pos = 0; pos < len; ) {
			const take = Math.min(blockLen - this.pos, len - pos);
			if (take === blockLen) {
				for (; blockLen <= len - pos; pos += blockLen) this.process(data, pos);
				continue;
			}
			buffer.set(data.subarray(pos, pos + take), this.pos);
			this.pos += take;
			pos += take;
			if (this.pos === blockLen) {
				this.process(buffer, 0, false);
				this.pos = 0;
			}
		}
		return this;
	}
	destroy() {
		this.h.fill(0);
		this.r.fill(0);
		this.buffer.fill(0);
		this.pad.fill(0);
	}
	digestInto(out) {
		exists3(this);
		output3(out, this);
		this.finished = true;
		const { buffer, h } = this;
		let { pos } = this;
		if (pos) {
			buffer[pos++] = 1;
			for (; pos < 16; pos++) buffer[pos] = 0;
			this.process(buffer, 0, true);
		}
		this.finalize();
		let opos = 0;
		for (let i = 0; i < 8; i++) {
			out[opos++] = h[i] >>> 0;
			out[opos++] = h[i] >>> 8;
		}
		return out;
	}
	digest() {
		const { buffer, outputLen } = this;
		this.digestInto(buffer);
		const res = buffer.slice(0, outputLen);
		this.destroy();
		return res;
	}
}
function wrapConstructorWithKey2(hashCons) {
	const hashC = (msg, key) => hashCons(key).update(toBytes3(msg)).digest();
	const tmp = hashCons(new Uint8Array(32));
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = (key) => hashCons(key);
	return hashC;
}
var poly1305 = wrapConstructorWithKey2((key) => new Poly1305(key));

// node_modules/@noble/ciphers/esm/_arx.js
var _utf8ToBytes = (str) =>
	Uint8Array.from(str.split("").map((c) => c.charCodeAt(0)));
var sigma16 = _utf8ToBytes("expand 16-byte k");
var sigma32 = _utf8ToBytes("expand 32-byte k");
var sigma16_32 = u32(sigma16);
var sigma32_32 = u32(sigma32);
var sigma = sigma32_32.slice();
function rotl(a, b) {
	return (a << b) | (a >>> (32 - b));
}
function isAligned32(b) {
	return b.byteOffset % 4 === 0;
}
var BLOCK_LEN = 64;
var BLOCK_LEN32 = 16;
var MAX_COUNTER = 2 ** 32 - 1;
var U32_EMPTY = new Uint32Array();
function runCipher(core, sigma2, key, nonce, data, output4, counter, rounds) {
	const len = data.length;
	const block = new Uint8Array(BLOCK_LEN);
	const b32 = u32(block);
	const isAligned = isAligned32(data) && isAligned32(output4);
	const d32 = isAligned ? u32(data) : U32_EMPTY;
	const o32 = isAligned ? u32(output4) : U32_EMPTY;
	for (let pos = 0; pos < len; counter++) {
		core(sigma2, key, nonce, b32, counter, rounds);
		if (counter >= MAX_COUNTER) throw new Error("arx: counter overflow");
		const take = Math.min(BLOCK_LEN, len - pos);
		if (isAligned && take === BLOCK_LEN) {
			const pos32 = pos / 4;
			if (pos % 4 !== 0) throw new Error("arx: invalid block position");
			for (let j = 0, posj; j < BLOCK_LEN32; j++) {
				posj = pos32 + j;
				o32[posj] = d32[posj] ^ b32[j];
			}
			pos += BLOCK_LEN;
			continue;
		}
		for (let j = 0, posj; j < take; j++) {
			posj = pos + j;
			output4[posj] = data[posj] ^ block[j];
		}
		pos += take;
	}
}
function createCipher(core, opts) {
	const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } =
		checkOpts(
			{
				allowShortKeys: false,
				counterLength: 8,
				counterRight: false,
				rounds: 20,
			},
			opts,
		);
	if (typeof core !== "function") throw new Error("core must be a function");
	number3(counterLength);
	number3(rounds);
	bool2(counterRight);
	bool2(allowShortKeys);
	return (key, nonce, data, output4, counter = 0) => {
		bytes3(key);
		bytes3(nonce);
		bytes3(data);
		const len = data.length;
		if (!output4) output4 = new Uint8Array(len);
		bytes3(output4);
		number3(counter);
		if (counter < 0 || counter >= MAX_COUNTER)
			throw new Error("arx: counter overflow");
		if (output4.length < len)
			throw new Error(
				`arx: output (${output4.length}) is shorter than data (${len})`,
			);
		const toClean = [];
		let l = key.length,
			k,
			sigma2;
		if (l === 32) {
			k = key.slice();
			toClean.push(k);
			sigma2 = sigma32_32;
		} else if (l === 16 && allowShortKeys) {
			k = new Uint8Array(32);
			k.set(key);
			k.set(key, 16);
			sigma2 = sigma16_32;
			toClean.push(k);
		} else {
			throw new Error(`arx: invalid 32-byte key, got length=${l}`);
		}
		if (!isAligned32(nonce)) {
			nonce = nonce.slice();
			toClean.push(nonce);
		}
		const k32 = u32(k);
		if (extendNonceFn) {
			if (nonce.length !== 24)
				throw new Error(`arx: extended nonce must be 24 bytes`);
			extendNonceFn(sigma2, k32, u32(nonce.subarray(0, 16)), k32);
			nonce = nonce.subarray(16);
		}
		const nonceNcLen = 16 - counterLength;
		if (nonceNcLen !== nonce.length)
			throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
		if (nonceNcLen !== 12) {
			const nc3 = new Uint8Array(12);
			nc3.set(nonce, counterRight ? 0 : 12 - nonce.length);
			nonce = nc3;
			toClean.push(nonce);
		}
		const n32 = u32(nonce);
		runCipher(core, sigma2, k32, n32, data, output4, counter, rounds);
		while (toClean.length > 0) toClean.pop().fill(0);
		return output4;
	};
}

// node_modules/@noble/ciphers/esm/chacha.js
function chachaCore(s, k, n, out, cnt, rounds = 20) {
	const y00 = s[0],
		y01 = s[1],
		y02 = s[2],
		y03 = s[3],
		y04 = k[0],
		y05 = k[1],
		y06 = k[2],
		y07 = k[3],
		y08 = k[4],
		y09 = k[5],
		y10 = k[6],
		y11 = k[7],
		y12 = cnt,
		y13 = n[0],
		y14 = n[1],
		y15 = n[2];
	let x00 = y00,
		x01 = y01,
		x02 = y02,
		x03 = y03,
		x04 = y04,
		x05 = y05,
		x06 = y06,
		x07 = y07,
		x08 = y08,
		x09 = y09,
		x10 = y10,
		x11 = y11,
		x12 = y12,
		x13 = y13,
		x14 = y14,
		x15 = y15;
	for (let r = 0; r < rounds; r += 2) {
		x00 = (x00 + x04) | 0;
		x12 = rotl(x12 ^ x00, 16);
		x08 = (x08 + x12) | 0;
		x04 = rotl(x04 ^ x08, 12);
		x00 = (x00 + x04) | 0;
		x12 = rotl(x12 ^ x00, 8);
		x08 = (x08 + x12) | 0;
		x04 = rotl(x04 ^ x08, 7);
		x01 = (x01 + x05) | 0;
		x13 = rotl(x13 ^ x01, 16);
		x09 = (x09 + x13) | 0;
		x05 = rotl(x05 ^ x09, 12);
		x01 = (x01 + x05) | 0;
		x13 = rotl(x13 ^ x01, 8);
		x09 = (x09 + x13) | 0;
		x05 = rotl(x05 ^ x09, 7);
		x02 = (x02 + x06) | 0;
		x14 = rotl(x14 ^ x02, 16);
		x10 = (x10 + x14) | 0;
		x06 = rotl(x06 ^ x10, 12);
		x02 = (x02 + x06) | 0;
		x14 = rotl(x14 ^ x02, 8);
		x10 = (x10 + x14) | 0;
		x06 = rotl(x06 ^ x10, 7);
		x03 = (x03 + x07) | 0;
		x15 = rotl(x15 ^ x03, 16);
		x11 = (x11 + x15) | 0;
		x07 = rotl(x07 ^ x11, 12);
		x03 = (x03 + x07) | 0;
		x15 = rotl(x15 ^ x03, 8);
		x11 = (x11 + x15) | 0;
		x07 = rotl(x07 ^ x11, 7);
		x00 = (x00 + x05) | 0;
		x15 = rotl(x15 ^ x00, 16);
		x10 = (x10 + x15) | 0;
		x05 = rotl(x05 ^ x10, 12);
		x00 = (x00 + x05) | 0;
		x15 = rotl(x15 ^ x00, 8);
		x10 = (x10 + x15) | 0;
		x05 = rotl(x05 ^ x10, 7);
		x01 = (x01 + x06) | 0;
		x12 = rotl(x12 ^ x01, 16);
		x11 = (x11 + x12) | 0;
		x06 = rotl(x06 ^ x11, 12);
		x01 = (x01 + x06) | 0;
		x12 = rotl(x12 ^ x01, 8);
		x11 = (x11 + x12) | 0;
		x06 = rotl(x06 ^ x11, 7);
		x02 = (x02 + x07) | 0;
		x13 = rotl(x13 ^ x02, 16);
		x08 = (x08 + x13) | 0;
		x07 = rotl(x07 ^ x08, 12);
		x02 = (x02 + x07) | 0;
		x13 = rotl(x13 ^ x02, 8);
		x08 = (x08 + x13) | 0;
		x07 = rotl(x07 ^ x08, 7);
		x03 = (x03 + x04) | 0;
		x14 = rotl(x14 ^ x03, 16);
		x09 = (x09 + x14) | 0;
		x04 = rotl(x04 ^ x09, 12);
		x03 = (x03 + x04) | 0;
		x14 = rotl(x14 ^ x03, 8);
		x09 = (x09 + x14) | 0;
		x04 = rotl(x04 ^ x09, 7);
	}
	let oi = 0;
	out[oi++] = (y00 + x00) | 0;
	out[oi++] = (y01 + x01) | 0;
	out[oi++] = (y02 + x02) | 0;
	out[oi++] = (y03 + x03) | 0;
	out[oi++] = (y04 + x04) | 0;
	out[oi++] = (y05 + x05) | 0;
	out[oi++] = (y06 + x06) | 0;
	out[oi++] = (y07 + x07) | 0;
	out[oi++] = (y08 + x08) | 0;
	out[oi++] = (y09 + x09) | 0;
	out[oi++] = (y10 + x10) | 0;
	out[oi++] = (y11 + x11) | 0;
	out[oi++] = (y12 + x12) | 0;
	out[oi++] = (y13 + x13) | 0;
	out[oi++] = (y14 + x14) | 0;
	out[oi++] = (y15 + x15) | 0;
}
function hchacha(s, k, i, o32) {
	let x00 = s[0],
		x01 = s[1],
		x02 = s[2],
		x03 = s[3],
		x04 = k[0],
		x05 = k[1],
		x06 = k[2],
		x07 = k[3],
		x08 = k[4],
		x09 = k[5],
		x10 = k[6],
		x11 = k[7],
		x12 = i[0],
		x13 = i[1],
		x14 = i[2],
		x15 = i[3];
	for (let r = 0; r < 20; r += 2) {
		x00 = (x00 + x04) | 0;
		x12 = rotl(x12 ^ x00, 16);
		x08 = (x08 + x12) | 0;
		x04 = rotl(x04 ^ x08, 12);
		x00 = (x00 + x04) | 0;
		x12 = rotl(x12 ^ x00, 8);
		x08 = (x08 + x12) | 0;
		x04 = rotl(x04 ^ x08, 7);
		x01 = (x01 + x05) | 0;
		x13 = rotl(x13 ^ x01, 16);
		x09 = (x09 + x13) | 0;
		x05 = rotl(x05 ^ x09, 12);
		x01 = (x01 + x05) | 0;
		x13 = rotl(x13 ^ x01, 8);
		x09 = (x09 + x13) | 0;
		x05 = rotl(x05 ^ x09, 7);
		x02 = (x02 + x06) | 0;
		x14 = rotl(x14 ^ x02, 16);
		x10 = (x10 + x14) | 0;
		x06 = rotl(x06 ^ x10, 12);
		x02 = (x02 + x06) | 0;
		x14 = rotl(x14 ^ x02, 8);
		x10 = (x10 + x14) | 0;
		x06 = rotl(x06 ^ x10, 7);
		x03 = (x03 + x07) | 0;
		x15 = rotl(x15 ^ x03, 16);
		x11 = (x11 + x15) | 0;
		x07 = rotl(x07 ^ x11, 12);
		x03 = (x03 + x07) | 0;
		x15 = rotl(x15 ^ x03, 8);
		x11 = (x11 + x15) | 0;
		x07 = rotl(x07 ^ x11, 7);
		x00 = (x00 + x05) | 0;
		x15 = rotl(x15 ^ x00, 16);
		x10 = (x10 + x15) | 0;
		x05 = rotl(x05 ^ x10, 12);
		x00 = (x00 + x05) | 0;
		x15 = rotl(x15 ^ x00, 8);
		x10 = (x10 + x15) | 0;
		x05 = rotl(x05 ^ x10, 7);
		x01 = (x01 + x06) | 0;
		x12 = rotl(x12 ^ x01, 16);
		x11 = (x11 + x12) | 0;
		x06 = rotl(x06 ^ x11, 12);
		x01 = (x01 + x06) | 0;
		x12 = rotl(x12 ^ x01, 8);
		x11 = (x11 + x12) | 0;
		x06 = rotl(x06 ^ x11, 7);
		x02 = (x02 + x07) | 0;
		x13 = rotl(x13 ^ x02, 16);
		x08 = (x08 + x13) | 0;
		x07 = rotl(x07 ^ x08, 12);
		x02 = (x02 + x07) | 0;
		x13 = rotl(x13 ^ x02, 8);
		x08 = (x08 + x13) | 0;
		x07 = rotl(x07 ^ x08, 7);
		x03 = (x03 + x04) | 0;
		x14 = rotl(x14 ^ x03, 16);
		x09 = (x09 + x14) | 0;
		x04 = rotl(x04 ^ x09, 12);
		x03 = (x03 + x04) | 0;
		x14 = rotl(x14 ^ x03, 8);
		x09 = (x09 + x14) | 0;
		x04 = rotl(x04 ^ x09, 7);
	}
	let oi = 0;
	o32[oi++] = x00;
	o32[oi++] = x01;
	o32[oi++] = x02;
	o32[oi++] = x03;
	o32[oi++] = x12;
	o32[oi++] = x13;
	o32[oi++] = x14;
	o32[oi++] = x15;
}
var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
	counterRight: false,
	counterLength: 4,
	allowShortKeys: false,
});
var xchacha20 = /* @__PURE__ */ createCipher(chachaCore, {
	counterRight: false,
	counterLength: 8,
	extendNonceFn: hchacha,
	allowShortKeys: false,
});
var ZEROS162 = /* @__PURE__ */ new Uint8Array(16);
var updatePadded = (h, msg) => {
	h.update(msg);
	const left = msg.length % 16;
	if (left) h.update(ZEROS162.subarray(left));
};
var ZEROS322 = /* @__PURE__ */ new Uint8Array(32);
function computeTag2(fn, key, nonce, data, AAD) {
	const authKey = fn(key, nonce, ZEROS322);
	const h = poly1305.create(authKey);
	if (AAD) updatePadded(h, AAD);
	updatePadded(h, data);
	const num = new Uint8Array(16);
	const view = createView3(num);
	setBigUint643(view, 0, BigInt(AAD ? AAD.length : 0), true);
	setBigUint643(view, 8, BigInt(data.length), true);
	h.update(num);
	const res = h.digest();
	authKey.fill(0);
	return res;
}
var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
	const tagLength = 16;
	bytes3(key, 32);
	bytes3(nonce);
	return {
		encrypt: (plaintext, output4) => {
			const plength = plaintext.length;
			const clength = plength + tagLength;
			if (output4) {
				bytes3(output4, clength);
			} else {
				output4 = new Uint8Array(clength);
			}
			xorStream(key, nonce, plaintext, output4, 1);
			const tag = computeTag2(
				xorStream,
				key,
				nonce,
				output4.subarray(0, -tagLength),
				AAD,
			);
			output4.set(tag, plength);
			return output4;
		},
		decrypt: (ciphertext, output4) => {
			const clength = ciphertext.length;
			const plength = clength - tagLength;
			if (clength < tagLength)
				throw new Error(`encrypted data must be at least ${tagLength} bytes`);
			if (output4) {
				bytes3(output4, plength);
			} else {
				output4 = new Uint8Array(plength);
			}
			const data = ciphertext.subarray(0, -tagLength);
			const passedTag = ciphertext.subarray(-tagLength);
			const tag = computeTag2(xorStream, key, nonce, data, AAD);
			if (!equalBytes2(passedTag, tag)) throw new Error("invalid tag");
			xorStream(key, nonce, data, output4, 1);
			return output4;
		},
	};
};
var chacha20poly1305 = /* @__PURE__ */ wrapCipher(
	{ blockSize: 64, nonceLength: 12, tagLength: 16 },
	_poly1305_aead(chacha20),
);
var xchacha20poly1305 = /* @__PURE__ */ wrapCipher(
	{ blockSize: 64, nonceLength: 24, tagLength: 16 },
	_poly1305_aead(xchacha20),
);

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/hmac.js
class HMAC2 extends Hash2 {
	constructor(hash3, _key) {
		super();
		this.finished = false;
		this.destroyed = false;
		_assert_default.hash(hash3);
		const key = toBytes2(_key);
		this.iHash = hash3.create();
		if (typeof this.iHash.update !== "function")
			throw new Error("Expected instance of class which extends utils.Hash");
		this.blockLen = this.iHash.blockLen;
		this.outputLen = this.iHash.outputLen;
		const blockLen = this.blockLen;
		const pad = new Uint8Array(blockLen);
		pad.set(key.length > blockLen ? hash3.create().update(key).digest() : key);
		for (let i = 0; i < pad.length; i++) pad[i] ^= 54;
		this.iHash.update(pad);
		this.oHash = hash3.create();
		for (let i = 0; i < pad.length; i++) pad[i] ^= 54 ^ 92;
		this.oHash.update(pad);
		pad.fill(0);
	}
	update(buf) {
		_assert_default.exists(this);
		this.iHash.update(buf);
		return this;
	}
	digestInto(out) {
		_assert_default.exists(this);
		_assert_default.bytes(out, this.outputLen);
		this.finished = true;
		this.iHash.digestInto(out);
		this.oHash.update(out);
		this.oHash.digestInto(out);
		this.destroy();
	}
	digest() {
		const out = new Uint8Array(this.oHash.outputLen);
		this.digestInto(out);
		return out;
	}
	_cloneInto(to) {
		to || (to = Object.create(Object.getPrototypeOf(this), {}));
		const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
		to = to;
		to.finished = finished;
		to.destroyed = destroyed;
		to.blockLen = blockLen;
		to.outputLen = outputLen;
		to.oHash = oHash._cloneInto(to.oHash);
		to.iHash = iHash._cloneInto(to.iHash);
		return to;
	}
	destroy() {
		this.destroyed = true;
		this.oHash.destroy();
		this.iHash.destroy();
	}
}
var hmac2 = (hash3, key, message) =>
	new HMAC2(hash3, key).update(message).digest();
hmac2.create = (hash3, key) => new HMAC2(hash3, key);

// node_modules/nostr-tools/node_modules/@noble/hashes/esm/hkdf.js
function extract(hash3, ikm, salt) {
	_assert_default.hash(hash3);
	if (salt === undefined) salt = new Uint8Array(hash3.outputLen);
	return hmac2(hash3, toBytes2(salt), toBytes2(ikm));
}
var HKDF_COUNTER = new Uint8Array([0]);
var EMPTY_BUFFER = new Uint8Array();
function expand(hash3, prk, info, length = 32) {
	_assert_default.hash(hash3);
	_assert_default.number(length);
	if (length > 255 * hash3.outputLen)
		throw new Error("Length should be <= 255*HashLen");
	const blocks = Math.ceil(length / hash3.outputLen);
	if (info === undefined) info = EMPTY_BUFFER;
	const okm = new Uint8Array(blocks * hash3.outputLen);
	const HMAC3 = hmac2.create(hash3, prk);
	const HMACTmp = HMAC3._cloneInto();
	const T = new Uint8Array(HMAC3.outputLen);
	for (let counter = 0; counter < blocks; counter++) {
		HKDF_COUNTER[0] = counter + 1;
		HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T)
			.update(info)
			.update(HKDF_COUNTER)
			.digestInto(T);
		okm.set(T, hash3.outputLen * counter);
		HMAC3._cloneInto(HMACTmp);
	}
	HMAC3.destroy();
	HMACTmp.destroy();
	T.fill(0);
	HKDF_COUNTER.fill(0);
	return okm.slice(0, length);
}

// node_modules/nostr-tools/lib/esm/index.js
var __defProp2 = Object.defineProperty;
var __export2 = (target, all) => {
	for (var name in all)
		__defProp2(target, name, { get: all[name], enumerable: true });
};
var verifiedSymbol = Symbol("verified");
var isRecord = (obj) => obj instanceof Object;
function validateEvent(event) {
	if (!isRecord(event)) return false;
	if (typeof event.kind !== "number") return false;
	if (typeof event.content !== "string") return false;
	if (typeof event.created_at !== "number") return false;
	if (typeof event.pubkey !== "string") return false;
	if (!event.pubkey.match(/^[a-f0-9]{64}$/)) return false;
	if (!Array.isArray(event.tags)) return false;
	for (let i2 = 0; i2 < event.tags.length; i2++) {
		const tag = event.tags[i2];
		if (!Array.isArray(tag)) return false;
		for (let j = 0; j < tag.length; j++) {
			if (typeof tag[j] !== "string") return false;
		}
	}
	return true;
}
var utils_exports = {};
__export2(utils_exports, {
	Queue: () => Queue,
	QueueNode: () => QueueNode,
	binarySearch: () => binarySearch,
	bytesToHex: () => bytesToHex2,
	hexToBytes: () => hexToBytes2,
	insertEventIntoAscendingList: () => insertEventIntoAscendingList,
	insertEventIntoDescendingList: () => insertEventIntoDescendingList,
	normalizeURL: () => normalizeURL,
	utf8Decoder: () => utf8Decoder,
	utf8Encoder: () => utf8Encoder,
});
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();
function normalizeURL(url) {
	try {
		if (url.indexOf("://") === -1) url = "wss://" + url;
		const p = new URL(url);
		p.pathname = p.pathname.replace(/\/+/g, "/");
		if (p.pathname.endsWith("/")) p.pathname = p.pathname.slice(0, -1);
		if (
			(p.port === "80" && p.protocol === "ws:") ||
			(p.port === "443" && p.protocol === "wss:")
		)
			p.port = "";
		p.searchParams.sort();
		p.hash = "";
		return p.toString();
	} catch (e) {
		throw new Error(`Invalid URL: ${url}`);
	}
}
function insertEventIntoDescendingList(sortedArray, event) {
	const [idx, found] = binarySearch(sortedArray, (b) => {
		if (event.id === b.id) return 0;
		if (event.created_at === b.created_at) return -1;
		return b.created_at - event.created_at;
	});
	if (!found) {
		sortedArray.splice(idx, 0, event);
	}
	return sortedArray;
}
function insertEventIntoAscendingList(sortedArray, event) {
	const [idx, found] = binarySearch(sortedArray, (b) => {
		if (event.id === b.id) return 0;
		if (event.created_at === b.created_at) return -1;
		return event.created_at - b.created_at;
	});
	if (!found) {
		sortedArray.splice(idx, 0, event);
	}
	return sortedArray;
}
function binarySearch(arr, compare) {
	let start = 0;
	let end = arr.length - 1;
	while (start <= end) {
		const mid = Math.floor((start + end) / 2);
		const cmp = compare(arr[mid]);
		if (cmp === 0) {
			return [mid, true];
		}
		if (cmp < 0) {
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}
	return [start, false];
}
var QueueNode = class {
	value;
	next = null;
	prev = null;
	constructor(message) {
		this.value = message;
	}
};
var Queue = class {
	first;
	last;
	constructor() {
		this.first = null;
		this.last = null;
	}
	enqueue(value) {
		const newNode = new QueueNode(value);
		if (!this.last) {
			this.first = newNode;
			this.last = newNode;
		} else if (this.last === this.first) {
			this.last = newNode;
			this.last.prev = this.first;
			this.first.next = newNode;
		} else {
			newNode.prev = this.last;
			this.last.next = newNode;
			this.last = newNode;
		}
		return true;
	}
	dequeue() {
		if (!this.first) return null;
		if (this.first === this.last) {
			const target2 = this.first;
			this.first = null;
			this.last = null;
			return target2.value;
		}
		const target = this.first;
		this.first = target.next;
		if (this.first) {
			this.first.prev = null;
		}
		return target.value;
	}
};
var JS = class {
	generateSecretKey() {
		return schnorr.utils.randomPrivateKey();
	}
	getPublicKey(secretKey) {
		return bytesToHex2(schnorr.getPublicKey(secretKey));
	}
	finalizeEvent(t, secretKey) {
		const event = t;
		event.pubkey = bytesToHex2(schnorr.getPublicKey(secretKey));
		event.id = getEventHash(event);
		event.sig = bytesToHex2(schnorr.sign(getEventHash(event), secretKey));
		event[verifiedSymbol] = true;
		return event;
	}
	verifyEvent(event) {
		if (typeof event[verifiedSymbol] === "boolean")
			return event[verifiedSymbol];
		const hash3 = getEventHash(event);
		if (hash3 !== event.id) {
			event[verifiedSymbol] = false;
			return false;
		}
		try {
			const valid = schnorr.verify(event.sig, hash3, event.pubkey);
			event[verifiedSymbol] = valid;
			return valid;
		} catch (err) {
			event[verifiedSymbol] = false;
			return false;
		}
	}
};
function serializeEvent(evt) {
	if (!validateEvent(evt))
		throw new Error("can't serialize event with wrong or missing properties");
	return JSON.stringify([
		0,
		evt.pubkey,
		evt.created_at,
		evt.kind,
		evt.tags,
		evt.content,
	]);
}
function getEventHash(event) {
	const eventHash = sha2562(utf8Encoder.encode(serializeEvent(event)));
	return bytesToHex2(eventHash);
}
var i = new JS();
var generateSecretKey = i.generateSecretKey;
var getPublicKey = i.getPublicKey;
var finalizeEvent = i.finalizeEvent;
var verifyEvent = i.verifyEvent;
var kinds_exports = {};
__export2(kinds_exports, {
	Application: () => Application,
	BadgeAward: () => BadgeAward,
	BadgeDefinition: () => BadgeDefinition,
	BlockedRelaysList: () => BlockedRelaysList,
	BookmarkList: () => BookmarkList,
	Bookmarksets: () => Bookmarksets,
	Calendar: () => Calendar,
	CalendarEventRSVP: () => CalendarEventRSVP,
	ChannelCreation: () => ChannelCreation,
	ChannelHideMessage: () => ChannelHideMessage,
	ChannelMessage: () => ChannelMessage,
	ChannelMetadata: () => ChannelMetadata,
	ChannelMuteUser: () => ChannelMuteUser,
	ClassifiedListing: () => ClassifiedListing,
	ClientAuth: () => ClientAuth,
	CommunitiesList: () => CommunitiesList,
	CommunityDefinition: () => CommunityDefinition,
	CommunityPostApproval: () => CommunityPostApproval,
	Contacts: () => Contacts,
	CreateOrUpdateProduct: () => CreateOrUpdateProduct,
	CreateOrUpdateStall: () => CreateOrUpdateStall,
	Curationsets: () => Curationsets,
	Date: () => Date2,
	DirectMessageRelaysList: () => DirectMessageRelaysList,
	DraftClassifiedListing: () => DraftClassifiedListing,
	DraftLong: () => DraftLong,
	Emojisets: () => Emojisets,
	EncryptedDirectMessage: () => EncryptedDirectMessage,
	EventDeletion: () => EventDeletion,
	FileMetadata: () => FileMetadata,
	FileServerPreference: () => FileServerPreference,
	Followsets: () => Followsets,
	GenericRepost: () => GenericRepost,
	Genericlists: () => Genericlists,
	GiftWrap: () => GiftWrap,
	HTTPAuth: () => HTTPAuth,
	Handlerinformation: () => Handlerinformation,
	Handlerrecommendation: () => Handlerrecommendation,
	Highlights: () => Highlights,
	InterestsList: () => InterestsList,
	Interestsets: () => Interestsets,
	JobFeedback: () => JobFeedback,
	JobRequest: () => JobRequest,
	JobResult: () => JobResult,
	Label: () => Label,
	LightningPubRPC: () => LightningPubRPC,
	LiveChatMessage: () => LiveChatMessage,
	LiveEvent: () => LiveEvent,
	LongFormArticle: () => LongFormArticle,
	Metadata: () => Metadata,
	Mutelist: () => Mutelist,
	NWCWalletInfo: () => NWCWalletInfo,
	NWCWalletRequest: () => NWCWalletRequest,
	NWCWalletResponse: () => NWCWalletResponse,
	NostrConnect: () => NostrConnect,
	OpenTimestamps: () => OpenTimestamps,
	Pinlist: () => Pinlist,
	PrivateDirectMessage: () => PrivateDirectMessage,
	ProblemTracker: () => ProblemTracker,
	ProfileBadges: () => ProfileBadges,
	PublicChatsList: () => PublicChatsList,
	Reaction: () => Reaction,
	RecommendRelay: () => RecommendRelay,
	RelayList: () => RelayList,
	Relaysets: () => Relaysets,
	Report: () => Report,
	Reporting: () => Reporting,
	Repost: () => Repost,
	Seal: () => Seal,
	SearchRelaysList: () => SearchRelaysList,
	ShortTextNote: () => ShortTextNote,
	Time: () => Time,
	UserEmojiList: () => UserEmojiList,
	UserStatuses: () => UserStatuses,
	Zap: () => Zap,
	ZapGoal: () => ZapGoal,
	ZapRequest: () => ZapRequest,
	classifyKind: () => classifyKind,
	isAddressableKind: () => isAddressableKind,
	isEphemeralKind: () => isEphemeralKind,
	isKind: () => isKind,
	isRegularKind: () => isRegularKind,
	isReplaceableKind: () => isReplaceableKind,
});
function isRegularKind(kind) {
	return (
		(1000 <= kind && kind < 1e4) ||
		[1, 2, 4, 5, 6, 7, 8, 16, 40, 41, 42, 43, 44].includes(kind)
	);
}
function isReplaceableKind(kind) {
	return [0, 3].includes(kind) || (1e4 <= kind && kind < 20000);
}
function isEphemeralKind(kind) {
	return 20000 <= kind && kind < 30000;
}
function isAddressableKind(kind) {
	return 30000 <= kind && kind < 40000;
}
function classifyKind(kind) {
	if (isRegularKind(kind)) return "regular";
	if (isReplaceableKind(kind)) return "replaceable";
	if (isEphemeralKind(kind)) return "ephemeral";
	if (isAddressableKind(kind)) return "parameterized";
	return "unknown";
}
function isKind(event, kind) {
	const kindAsArray = kind instanceof Array ? kind : [kind];
	return (validateEvent(event) && kindAsArray.includes(event.kind)) || false;
}
var Metadata = 0;
var ShortTextNote = 1;
var RecommendRelay = 2;
var Contacts = 3;
var EncryptedDirectMessage = 4;
var EventDeletion = 5;
var Repost = 6;
var Reaction = 7;
var BadgeAward = 8;
var Seal = 13;
var PrivateDirectMessage = 14;
var GenericRepost = 16;
var ChannelCreation = 40;
var ChannelMetadata = 41;
var ChannelMessage = 42;
var ChannelHideMessage = 43;
var ChannelMuteUser = 44;
var OpenTimestamps = 1040;
var GiftWrap = 1059;
var FileMetadata = 1063;
var LiveChatMessage = 1311;
var ProblemTracker = 1971;
var Report = 1984;
var Reporting = 1984;
var Label = 1985;
var CommunityPostApproval = 4550;
var JobRequest = 5999;
var JobResult = 6999;
var JobFeedback = 7000;
var ZapGoal = 9041;
var ZapRequest = 9734;
var Zap = 9735;
var Highlights = 9802;
var Mutelist = 1e4;
var Pinlist = 10001;
var RelayList = 10002;
var BookmarkList = 10003;
var CommunitiesList = 10004;
var PublicChatsList = 10005;
var BlockedRelaysList = 10006;
var SearchRelaysList = 10007;
var InterestsList = 10015;
var UserEmojiList = 10030;
var DirectMessageRelaysList = 10050;
var FileServerPreference = 10096;
var NWCWalletInfo = 13194;
var LightningPubRPC = 21000;
var ClientAuth = 22242;
var NWCWalletRequest = 23194;
var NWCWalletResponse = 23195;
var NostrConnect = 24133;
var HTTPAuth = 27235;
var Followsets = 30000;
var Genericlists = 30001;
var Relaysets = 30002;
var Bookmarksets = 30003;
var Curationsets = 30004;
var ProfileBadges = 30008;
var BadgeDefinition = 30009;
var Interestsets = 30015;
var CreateOrUpdateStall = 30017;
var CreateOrUpdateProduct = 30018;
var LongFormArticle = 30023;
var DraftLong = 30024;
var Emojisets = 30030;
var Application = 30078;
var LiveEvent = 30311;
var UserStatuses = 30315;
var ClassifiedListing = 30402;
var DraftClassifiedListing = 30403;
var Date2 = 31922;
var Time = 31923;
var Calendar = 31924;
var CalendarEventRSVP = 31925;
var Handlerrecommendation = 31989;
var Handlerinformation = 31990;
var CommunityDefinition = 34550;
function matchFilter(filter, event) {
	if (filter.ids && filter.ids.indexOf(event.id) === -1) {
		return false;
	}
	if (filter.kinds && filter.kinds.indexOf(event.kind) === -1) {
		return false;
	}
	if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
		return false;
	}
	for (const f in filter) {
		if (f[0] === "#") {
			const tagName = f.slice(1);
			const values = filter[`#${tagName}`];
			if (
				values &&
				!event.tags.find(
					([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1,
				)
			)
				return false;
		}
	}
	if (filter.since && event.created_at < filter.since) return false;
	if (filter.until && event.created_at > filter.until) return false;
	return true;
}
function matchFilters(filters, event) {
	for (let i2 = 0; i2 < filters.length; i2++) {
		if (matchFilter(filters[i2], event)) {
			return true;
		}
	}
	return false;
}
var fakejson_exports = {};
__export2(fakejson_exports, {
	getHex64: () => getHex64,
	getInt: () => getInt,
	getSubscriptionId: () => getSubscriptionId,
	matchEventId: () => matchEventId,
	matchEventKind: () => matchEventKind,
	matchEventPubkey: () => matchEventPubkey,
});
function getHex64(json, field) {
	const len = field.length + 3;
	const idx = json.indexOf(`"${field}":`) + len;
	const s = json.slice(idx).indexOf(`"`) + idx + 1;
	return json.slice(s, s + 64);
}
function getInt(json, field) {
	const len = field.length;
	const idx = json.indexOf(`"${field}":`) + len + 3;
	const sliced = json.slice(idx);
	const end = Math.min(sliced.indexOf(","), sliced.indexOf("}"));
	return Number.parseInt(sliced.slice(0, end), 10);
}
function getSubscriptionId(json) {
	const idx = json.slice(0, 22).indexOf(`"EVENT"`);
	if (idx === -1) return null;
	const pstart = json.slice(idx + 7 + 1).indexOf(`"`);
	if (pstart === -1) return null;
	const start = idx + 7 + 1 + pstart;
	const pend = json.slice(start + 1, 80).indexOf(`"`);
	if (pend === -1) return null;
	const end = start + 1 + pend;
	return json.slice(start + 1, end);
}
function matchEventId(json, id) {
	return id === getHex64(json, "id");
}
function matchEventPubkey(json, pubkey) {
	return pubkey === getHex64(json, "pubkey");
}
function matchEventKind(json, kind) {
	return kind === getInt(json, "kind");
}
var nip42_exports = {};
__export2(nip42_exports, {
	makeAuthEvent: () => makeAuthEvent,
});
function makeAuthEvent(relayURL, challenge2) {
	return {
		kind: ClientAuth,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["relay", relayURL],
			["challenge", challenge2],
		],
		content: "",
	};
}
async function yieldThread() {
	return new Promise((resolve) => {
		const ch = new MessageChannel();
		const handler = () => {
			ch.port1.removeEventListener("message", handler);
			resolve();
		};
		ch.port1.addEventListener("message", handler);
		ch.port2.postMessage(0);
		ch.port1.start();
	});
}
var SendingOnClosedConnection = class extends Error {
	constructor(message, relay) {
		super(
			`Tried to send message '${message} on a closed connection to ${relay}.`,
		);
		this.name = "SendingOnClosedConnection";
	}
};
var AbstractRelay = class {
	url;
	_connected = false;
	onclose = null;
	onnotice = (msg) => console.debug(`NOTICE from ${this.url}: ${msg}`);
	_onauth = null;
	baseEoseTimeout = 4400;
	connectionTimeout = 4400;
	publishTimeout = 4400;
	openSubs = /* @__PURE__ */ new Map();
	connectionTimeoutHandle;
	connectionPromise;
	openCountRequests = /* @__PURE__ */ new Map();
	openEventPublishes = /* @__PURE__ */ new Map();
	ws;
	incomingMessageQueue = new Queue();
	queueRunning = false;
	challenge;
	authPromise;
	serial = 0;
	verifyEvent;
	_WebSocket;
	constructor(url, opts) {
		this.url = normalizeURL(url);
		this.verifyEvent = opts.verifyEvent;
		this._WebSocket = opts.websocketImplementation || WebSocket;
	}
	static async connect(url, opts) {
		const relay = new AbstractRelay(url, opts);
		await relay.connect();
		return relay;
	}
	closeAllSubscriptions(reason) {
		for (const [_, sub] of this.openSubs) {
			sub.close(reason);
		}
		this.openSubs.clear();
		for (const [_, ep] of this.openEventPublishes) {
			ep.reject(new Error(reason));
		}
		this.openEventPublishes.clear();
		for (const [_, cr] of this.openCountRequests) {
			cr.reject(new Error(reason));
		}
		this.openCountRequests.clear();
	}
	get connected() {
		return this._connected;
	}
	async connect() {
		if (this.connectionPromise) return this.connectionPromise;
		this.challenge = undefined;
		this.authPromise = undefined;
		this.connectionPromise = new Promise((resolve, reject) => {
			this.connectionTimeoutHandle = setTimeout(() => {
				reject("connection timed out");
				this.connectionPromise = undefined;
				this.onclose?.();
				this.closeAllSubscriptions("relay connection timed out");
			}, this.connectionTimeout);
			try {
				this.ws = new this._WebSocket(this.url);
			} catch (err) {
				clearTimeout(this.connectionTimeoutHandle);
				reject(err);
				return;
			}
			this.ws.onopen = () => {
				clearTimeout(this.connectionTimeoutHandle);
				this._connected = true;
				resolve();
			};
			this.ws.onerror = (ev) => {
				clearTimeout(this.connectionTimeoutHandle);
				reject(ev.message || "websocket error");
				if (this._connected) {
					this._connected = false;
					this.connectionPromise = undefined;
					this.onclose?.();
					this.closeAllSubscriptions("relay connection errored");
				}
			};
			this.ws.onclose = (ev) => {
				clearTimeout(this.connectionTimeoutHandle);
				reject(ev.message || "websocket closed");
				if (this._connected) {
					this._connected = false;
					this.connectionPromise = undefined;
					this.onclose?.();
					this.closeAllSubscriptions("relay connection closed");
				}
			};
			this.ws.onmessage = this._onmessage.bind(this);
		});
		return this.connectionPromise;
	}
	async runQueue() {
		this.queueRunning = true;
		while (true) {
			if (this.handleNext() === false) {
				break;
			}
			await yieldThread();
		}
		this.queueRunning = false;
	}
	handleNext() {
		const json = this.incomingMessageQueue.dequeue();
		if (!json) {
			return false;
		}
		const subid = getSubscriptionId(json);
		if (subid) {
			const so = this.openSubs.get(subid);
			if (!so) {
				return;
			}
			const id = getHex64(json, "id");
			const alreadyHave = so.alreadyHaveEvent?.(id);
			so.receivedEvent?.(this, id);
			if (alreadyHave) {
				return;
			}
		}
		try {
			const data = JSON.parse(json);
			switch (data[0]) {
				case "EVENT": {
					const so = this.openSubs.get(data[1]);
					const event = data[2];
					if (this.verifyEvent(event) && matchFilters(so.filters, event)) {
						so.onevent(event);
					}
					return;
				}
				case "COUNT": {
					const id = data[1];
					const payload = data[2];
					const cr = this.openCountRequests.get(id);
					if (cr) {
						cr.resolve(payload.count);
						this.openCountRequests.delete(id);
					}
					return;
				}
				case "EOSE": {
					const so = this.openSubs.get(data[1]);
					if (!so) return;
					so.receivedEose();
					return;
				}
				case "OK": {
					const id = data[1];
					const ok = data[2];
					const reason = data[3];
					const ep = this.openEventPublishes.get(id);
					if (ep) {
						clearTimeout(ep.timeout);
						if (ok) ep.resolve(reason);
						else ep.reject(new Error(reason));
						this.openEventPublishes.delete(id);
					}
					return;
				}
				case "CLOSED": {
					const id = data[1];
					const so = this.openSubs.get(id);
					if (!so) return;
					so.closed = true;
					so.close(data[2]);
					return;
				}
				case "NOTICE":
					this.onnotice(data[1]);
					return;
				case "AUTH": {
					this.challenge = data[1];
					this._onauth?.(data[1]);
					return;
				}
			}
		} catch (err) {
			return;
		}
	}
	async send(message) {
		if (!this.connectionPromise)
			throw new SendingOnClosedConnection(message, this.url);
		this.connectionPromise.then(() => {
			this.ws?.send(message);
		});
	}
	async auth(signAuthEvent) {
		const challenge2 = this.challenge;
		if (!challenge2)
			throw new Error("can't perform auth, no challenge was received");
		if (this.authPromise) return this.authPromise;
		this.authPromise = new Promise(async (resolve, reject) => {
			const evt = await signAuthEvent(makeAuthEvent(this.url, challenge2));
			const timeout = setTimeout(() => {
				const ep = this.openEventPublishes.get(evt.id);
				if (ep) {
					ep.reject(new Error("auth timed out"));
					this.openEventPublishes.delete(evt.id);
				}
			}, this.publishTimeout);
			this.openEventPublishes.set(evt.id, { resolve, reject, timeout });
			this.send('["AUTH",' + JSON.stringify(evt) + "]");
		});
		return this.authPromise;
	}
	async publish(event) {
		const ret = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				const ep = this.openEventPublishes.get(event.id);
				if (ep) {
					ep.reject(new Error("publish timed out"));
					this.openEventPublishes.delete(event.id);
				}
			}, this.publishTimeout);
			this.openEventPublishes.set(event.id, { resolve, reject, timeout });
		});
		this.send('["EVENT",' + JSON.stringify(event) + "]");
		return ret;
	}
	async count(filters, params) {
		this.serial++;
		const id = params?.id || "count:" + this.serial;
		const ret = new Promise((resolve, reject) => {
			this.openCountRequests.set(id, { resolve, reject });
		});
		this.send('["COUNT","' + id + '",' + JSON.stringify(filters).substring(1));
		return ret;
	}
	subscribe(filters, params) {
		const subscription = this.prepareSubscription(filters, params);
		subscription.fire();
		return subscription;
	}
	prepareSubscription(filters, params) {
		this.serial++;
		const id =
			params.id || (params.label ? params.label + ":" : "sub:") + this.serial;
		const subscription = new Subscription(this, id, filters, params);
		this.openSubs.set(id, subscription);
		return subscription;
	}
	close() {
		this.closeAllSubscriptions("relay connection closed by us");
		this._connected = false;
		this.ws?.close();
	}
	_onmessage(ev) {
		this.incomingMessageQueue.enqueue(ev.data);
		if (!this.queueRunning) {
			this.runQueue();
		}
	}
};
var Subscription = class {
	relay;
	id;
	closed = false;
	eosed = false;
	filters;
	alreadyHaveEvent;
	receivedEvent;
	onevent;
	oneose;
	onclose;
	eoseTimeout;
	eoseTimeoutHandle;
	constructor(relay, id, filters, params) {
		this.relay = relay;
		this.filters = filters;
		this.id = id;
		this.alreadyHaveEvent = params.alreadyHaveEvent;
		this.receivedEvent = params.receivedEvent;
		this.eoseTimeout = params.eoseTimeout || relay.baseEoseTimeout;
		this.oneose = params.oneose;
		this.onclose = params.onclose;
		this.onevent =
			params.onevent ||
			((event) => {
				console.warn(
					`onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
					event,
				);
			});
	}
	fire() {
		this.relay.send(
			'["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1),
		);
		this.eoseTimeoutHandle = setTimeout(
			this.receivedEose.bind(this),
			this.eoseTimeout,
		);
	}
	receivedEose() {
		if (this.eosed) return;
		clearTimeout(this.eoseTimeoutHandle);
		this.eosed = true;
		this.oneose?.();
	}
	close(reason = "closed by caller") {
		if (!this.closed && this.relay.connected) {
			try {
				this.relay.send('["CLOSE",' + JSON.stringify(this.id) + "]");
			} catch (err) {
				if (err instanceof SendingOnClosedConnection) {
				} else {
					throw err;
				}
			}
			this.closed = true;
		}
		this.relay.openSubs.delete(this.id);
		this.onclose?.(reason);
	}
};
var _WebSocket;
try {
	_WebSocket = WebSocket;
} catch {}
var _WebSocket2;
try {
	_WebSocket2 = WebSocket;
} catch {}
var nip19_exports = {};
__export2(nip19_exports, {
	BECH32_REGEX: () => BECH32_REGEX,
	Bech32MaxSize: () => Bech32MaxSize,
	NostrTypeGuard: () => NostrTypeGuard,
	decode: () => decode,
	decodeNostrURI: () => decodeNostrURI,
	encodeBytes: () => encodeBytes,
	naddrEncode: () => naddrEncode,
	neventEncode: () => neventEncode,
	noteEncode: () => noteEncode,
	nprofileEncode: () => nprofileEncode,
	npubEncode: () => npubEncode,
	nsecEncode: () => nsecEncode,
});
var NostrTypeGuard = {
	isNProfile: (value) => /^nprofile1[a-z\d]+$/.test(value || ""),
	isNEvent: (value) => /^nevent1[a-z\d]+$/.test(value || ""),
	isNAddr: (value) => /^naddr1[a-z\d]+$/.test(value || ""),
	isNSec: (value) => /^nsec1[a-z\d]{58}$/.test(value || ""),
	isNPub: (value) => /^npub1[a-z\d]{58}$/.test(value || ""),
	isNote: (value) => /^note1[a-z\d]+$/.test(value || ""),
	isNcryptsec: (value) => /^ncryptsec1[a-z\d]+$/.test(value || ""),
};
var Bech32MaxSize = 5000;
var BECH32_REGEX = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/;
function integerToUint8Array(number4) {
	const uint8Array = new Uint8Array(4);
	uint8Array[0] = (number4 >> 24) & 255;
	uint8Array[1] = (number4 >> 16) & 255;
	uint8Array[2] = (number4 >> 8) & 255;
	uint8Array[3] = number4 & 255;
	return uint8Array;
}
function decodeNostrURI(nip19code) {
	try {
		if (nip19code.startsWith("nostr:")) nip19code = nip19code.substring(6);
		return decode(nip19code);
	} catch (_err) {
		return { type: "invalid", data: null };
	}
}
function decode(code) {
	const { prefix, words } = bech32.decode(code, Bech32MaxSize);
	const data = new Uint8Array(bech32.fromWords(words));
	switch (prefix) {
		case "nprofile": {
			const tlv = parseTLV(data);
			if (!tlv[0]?.[0]) throw new Error("missing TLV 0 for nprofile");
			if (tlv[0][0].length !== 32) throw new Error("TLV 0 should be 32 bytes");
			return {
				type: "nprofile",
				data: {
					pubkey: bytesToHex2(tlv[0][0]),
					relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
				},
			};
		}
		case "nevent": {
			const tlv = parseTLV(data);
			if (!tlv[0]?.[0]) throw new Error("missing TLV 0 for nevent");
			if (tlv[0][0].length !== 32) throw new Error("TLV 0 should be 32 bytes");
			if (tlv[2] && tlv[2][0].length !== 32)
				throw new Error("TLV 2 should be 32 bytes");
			if (tlv[3] && tlv[3][0].length !== 4)
				throw new Error("TLV 3 should be 4 bytes");
			return {
				type: "nevent",
				data: {
					id: bytesToHex2(tlv[0][0]),
					relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
					author: tlv[2]?.[0] ? bytesToHex2(tlv[2][0]) : undefined,
					kind: tlv[3]?.[0]
						? Number.parseInt(bytesToHex2(tlv[3][0]), 16)
						: undefined,
				},
			};
		}
		case "naddr": {
			const tlv = parseTLV(data);
			if (!tlv[0]?.[0]) throw new Error("missing TLV 0 for naddr");
			if (!tlv[2]?.[0]) throw new Error("missing TLV 2 for naddr");
			if (tlv[2][0].length !== 32) throw new Error("TLV 2 should be 32 bytes");
			if (!tlv[3]?.[0]) throw new Error("missing TLV 3 for naddr");
			if (tlv[3][0].length !== 4) throw new Error("TLV 3 should be 4 bytes");
			return {
				type: "naddr",
				data: {
					identifier: utf8Decoder.decode(tlv[0][0]),
					pubkey: bytesToHex2(tlv[2][0]),
					kind: Number.parseInt(bytesToHex2(tlv[3][0]), 16),
					relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
				},
			};
		}
		case "nsec":
			return { type: prefix, data };
		case "npub":
		case "note":
			return { type: prefix, data: bytesToHex2(data) };
		default:
			throw new Error(`unknown prefix ${prefix}`);
	}
}
function parseTLV(data) {
	const result = {};
	let rest = data;
	while (rest.length > 0) {
		const t = rest[0];
		const l = rest[1];
		const v = rest.slice(2, 2 + l);
		rest = rest.slice(2 + l);
		if (v.length < l) throw new Error(`not enough data to read on TLV ${t}`);
		result[t] = result[t] || [];
		result[t].push(v);
	}
	return result;
}
function nsecEncode(key) {
	return encodeBytes("nsec", key);
}
function npubEncode(hex2) {
	return encodeBytes("npub", hexToBytes2(hex2));
}
function noteEncode(hex2) {
	return encodeBytes("note", hexToBytes2(hex2));
}
function encodeBech32(prefix, data) {
	const words = bech32.toWords(data);
	return bech32.encode(prefix, words, Bech32MaxSize);
}
function encodeBytes(prefix, bytes4) {
	return encodeBech32(prefix, bytes4);
}
function nprofileEncode(profile) {
	const data = encodeTLV({
		0: [hexToBytes2(profile.pubkey)],
		1: (profile.relays || []).map((url) => utf8Encoder.encode(url)),
	});
	return encodeBech32("nprofile", data);
}
function neventEncode(event) {
	let kindArray;
	if (event.kind !== undefined) {
		kindArray = integerToUint8Array(event.kind);
	}
	const data = encodeTLV({
		0: [hexToBytes2(event.id)],
		1: (event.relays || []).map((url) => utf8Encoder.encode(url)),
		2: event.author ? [hexToBytes2(event.author)] : [],
		3: kindArray ? [new Uint8Array(kindArray)] : [],
	});
	return encodeBech32("nevent", data);
}
function naddrEncode(addr) {
	const kind = new ArrayBuffer(4);
	new DataView(kind).setUint32(0, addr.kind, false);
	const data = encodeTLV({
		0: [utf8Encoder.encode(addr.identifier)],
		1: (addr.relays || []).map((url) => utf8Encoder.encode(url)),
		2: [hexToBytes2(addr.pubkey)],
		3: [new Uint8Array(kind)],
	});
	return encodeBech32("naddr", data);
}
function encodeTLV(tlv) {
	const entries = [];
	Object.entries(tlv)
		.reverse()
		.forEach(([t, vs]) => {
			vs.forEach((v) => {
				const entry = new Uint8Array(v.length + 2);
				entry.set([Number.parseInt(t)], 0);
				entry.set([v.length], 1);
				entry.set(v, 2);
				entries.push(entry);
			});
		});
	return concatBytes3(...entries);
}
var nip04_exports = {};
__export2(nip04_exports, {
	decrypt: () => decrypt2,
	encrypt: () => encrypt2,
});
function encrypt2(secretKey, pubkey, text) {
	const privkey =
		secretKey instanceof Uint8Array ? bytesToHex2(secretKey) : secretKey;
	const key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
	const normalizedKey = getNormalizedX(key);
	const iv = Uint8Array.from(randomBytes2(16));
	const plaintext = utf8Encoder.encode(text);
	const ciphertext = cbc(normalizedKey, iv).encrypt(plaintext);
	const ctb64 = base64.encode(new Uint8Array(ciphertext));
	const ivb64 = base64.encode(new Uint8Array(iv.buffer));
	return `${ctb64}?iv=${ivb64}`;
}
function decrypt2(secretKey, pubkey, data) {
	const privkey =
		secretKey instanceof Uint8Array ? bytesToHex2(secretKey) : secretKey;
	const [ctb64, ivb64] = data.split("?iv=");
	const key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
	const normalizedKey = getNormalizedX(key);
	const iv = base64.decode(ivb64);
	const ciphertext = base64.decode(ctb64);
	const plaintext = cbc(normalizedKey, iv).decrypt(ciphertext);
	return utf8Decoder.decode(plaintext);
}
function getNormalizedX(key) {
	return key.slice(1, 33);
}
var nip05_exports = {};
__export2(nip05_exports, {
	NIP05_REGEX: () => NIP05_REGEX,
	isNip05: () => isNip05,
	isValid: () => isValid,
	queryProfile: () => queryProfile,
	searchDomain: () => searchDomain,
	useFetchImplementation: () => useFetchImplementation,
});
var NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;
var isNip05 = (value) => NIP05_REGEX.test(value || "");
var _fetch;
try {
	_fetch = fetch;
} catch (_) {}
function useFetchImplementation(fetchImplementation) {
	_fetch = fetchImplementation;
}
async function searchDomain(domain, query = "") {
	try {
		const url = `https://${domain}/.well-known/nostr.json?name=${query}`;
		const res = await _fetch(url, { redirect: "manual" });
		if (res.status !== 200) {
			throw Error("Wrong response code");
		}
		const json = await res.json();
		return json.names;
	} catch (_) {
		return {};
	}
}
async function queryProfile(fullname) {
	const match = fullname.match(NIP05_REGEX);
	if (!match) return null;
	const [, name = "_", domain] = match;
	try {
		const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
		const res = await _fetch(url, { redirect: "manual" });
		if (res.status !== 200) {
			throw Error("Wrong response code");
		}
		const json = await res.json();
		const pubkey = json.names[name];
		return pubkey ? { pubkey, relays: json.relays?.[pubkey] } : null;
	} catch (_e) {
		return null;
	}
}
async function isValid(pubkey, nip05) {
	const res = await queryProfile(nip05);
	return res ? res.pubkey === pubkey : false;
}
var nip10_exports = {};
__export2(nip10_exports, {
	parse: () => parse,
});
function parse(event) {
	const result = {
		reply: undefined,
		root: undefined,
		mentions: [],
		profiles: [],
		quotes: [],
	};
	let maybeParent;
	let maybeRoot;
	for (let i2 = event.tags.length - 1; i2 >= 0; i2--) {
		const tag = event.tags[i2];
		if (tag[0] === "e" && tag[1]) {
			const [_, eTagEventId, eTagRelayUrl, eTagMarker, eTagAuthor] = tag;
			const eventPointer = {
				id: eTagEventId,
				relays: eTagRelayUrl ? [eTagRelayUrl] : [],
				author: eTagAuthor,
			};
			if (eTagMarker === "root") {
				result.root = eventPointer;
				continue;
			}
			if (eTagMarker === "reply") {
				result.reply = eventPointer;
				continue;
			}
			if (eTagMarker === "mention") {
				result.mentions.push(eventPointer);
				continue;
			}
			if (!maybeParent) {
				maybeParent = eventPointer;
			} else {
				maybeRoot = eventPointer;
			}
			result.mentions.push(eventPointer);
			continue;
		}
		if (tag[0] === "q" && tag[1]) {
			const [_, eTagEventId, eTagRelayUrl] = tag;
			result.quotes.push({
				id: eTagEventId,
				relays: eTagRelayUrl ? [eTagRelayUrl] : [],
			});
		}
		if (tag[0] === "p" && tag[1]) {
			result.profiles.push({
				pubkey: tag[1],
				relays: tag[2] ? [tag[2]] : [],
			});
			continue;
		}
	}
	if (!result.root) {
		result.root = maybeRoot || maybeParent || result.reply;
	}
	if (!result.reply) {
		result.reply = maybeParent || result.root;
	}
	[result.reply, result.root].forEach((ref) => {
		if (!ref) return;
		const idx = result.mentions.indexOf(ref);
		if (idx !== -1) {
			result.mentions.splice(idx, 1);
		}
		if (ref.author) {
			const author = result.profiles.find((p) => p.pubkey === ref.author);
			if (author && author.relays) {
				if (!ref.relays) {
					ref.relays = [];
				}
				author.relays.forEach((url) => {
					if (ref.relays?.indexOf(url) === -1) ref.relays.push(url);
				});
				author.relays = ref.relays;
			}
		}
	});
	result.mentions.forEach((ref) => {
		if (ref.author) {
			const author = result.profiles.find((p) => p.pubkey === ref.author);
			if (author && author.relays) {
				if (!ref.relays) {
					ref.relays = [];
				}
				author.relays.forEach((url) => {
					if (ref.relays.indexOf(url) === -1) ref.relays.push(url);
				});
				author.relays = ref.relays;
			}
		}
	});
	return result;
}
var nip11_exports = {};
__export2(nip11_exports, {
	fetchRelayInformation: () => fetchRelayInformation,
	useFetchImplementation: () => useFetchImplementation2,
});
var _fetch2;
try {
	_fetch2 = fetch;
} catch {}
function useFetchImplementation2(fetchImplementation) {
	_fetch2 = fetchImplementation;
}
async function fetchRelayInformation(url) {
	return await (
		await fetch(url.replace("ws://", "http://").replace("wss://", "https://"), {
			headers: { Accept: "application/nostr+json" },
		})
	).json();
}
var nip13_exports = {};
__export2(nip13_exports, {
	fastEventHash: () => fastEventHash,
	getPow: () => getPow,
	minePow: () => minePow,
});
function getPow(hex2) {
	let count = 0;
	for (let i2 = 0; i2 < 64; i2 += 8) {
		const nibble = Number.parseInt(hex2.substring(i2, i2 + 8), 16);
		if (nibble === 0) {
			count += 32;
		} else {
			count += Math.clz32(nibble);
			break;
		}
	}
	return count;
}
function minePow(unsigned, difficulty) {
	let count = 0;
	const event = unsigned;
	const tag = ["nonce", count.toString(), difficulty.toString()];
	event.tags.push(tag);
	while (true) {
		const now2 = Math.floor(new Date().getTime() / 1000);
		if (now2 !== event.created_at) {
			count = 0;
			event.created_at = now2;
		}
		tag[1] = (++count).toString();
		event.id = fastEventHash(event);
		if (getPow(event.id) >= difficulty) {
			break;
		}
	}
	return event;
}
function fastEventHash(evt) {
	return bytesToHex2(
		sha2562(
			utf8Encoder.encode(
				JSON.stringify([
					0,
					evt.pubkey,
					evt.created_at,
					evt.kind,
					evt.tags,
					evt.content,
				]),
			),
		),
	);
}
var nip17_exports = {};
__export2(nip17_exports, {
	unwrapEvent: () => unwrapEvent2,
	unwrapManyEvents: () => unwrapManyEvents2,
	wrapEvent: () => wrapEvent2,
	wrapManyEvents: () => wrapManyEvents2,
});
var nip59_exports = {};
__export2(nip59_exports, {
	createRumor: () => createRumor,
	createSeal: () => createSeal,
	createWrap: () => createWrap,
	unwrapEvent: () => unwrapEvent,
	unwrapManyEvents: () => unwrapManyEvents,
	wrapEvent: () => wrapEvent,
	wrapManyEvents: () => wrapManyEvents,
});
var nip44_exports = {};
__export2(nip44_exports, {
	decrypt: () => decrypt22,
	encrypt: () => encrypt22,
	getConversationKey: () => getConversationKey,
	v2: () => v2,
});
var minPlaintextSize = 1;
var maxPlaintextSize = 65535;
function getConversationKey(privkeyA, pubkeyB) {
	const sharedX = secp256k1
		.getSharedSecret(privkeyA, "02" + pubkeyB)
		.subarray(1, 33);
	return extract(sha2562, sharedX, "nip44-v2");
}
function getMessageKeys(conversationKey, nonce) {
	const keys = expand(sha2562, conversationKey, nonce, 76);
	return {
		chacha_key: keys.subarray(0, 32),
		chacha_nonce: keys.subarray(32, 44),
		hmac_key: keys.subarray(44, 76),
	};
}
function calcPaddedLen(len) {
	if (!Number.isSafeInteger(len) || len < 1)
		throw new Error("expected positive integer");
	if (len <= 32) return 32;
	const nextPower = 1 << (Math.floor(Math.log2(len - 1)) + 1);
	const chunk = nextPower <= 256 ? 32 : nextPower / 8;
	return chunk * (Math.floor((len - 1) / chunk) + 1);
}
function writeU16BE(num) {
	if (
		!Number.isSafeInteger(num) ||
		num < minPlaintextSize ||
		num > maxPlaintextSize
	)
		throw new Error(
			"invalid plaintext size: must be between 1 and 65535 bytes",
		);
	const arr = new Uint8Array(2);
	new DataView(arr.buffer).setUint16(0, num, false);
	return arr;
}
function pad(plaintext) {
	const unpadded = utf8Encoder.encode(plaintext);
	const unpaddedLen = unpadded.length;
	const prefix = writeU16BE(unpaddedLen);
	const suffix = new Uint8Array(calcPaddedLen(unpaddedLen) - unpaddedLen);
	return concatBytes3(prefix, unpadded, suffix);
}
function unpad(padded) {
	const unpaddedLen = new DataView(padded.buffer).getUint16(0);
	const unpadded = padded.subarray(2, 2 + unpaddedLen);
	if (
		unpaddedLen < minPlaintextSize ||
		unpaddedLen > maxPlaintextSize ||
		unpadded.length !== unpaddedLen ||
		padded.length !== 2 + calcPaddedLen(unpaddedLen)
	)
		throw new Error("invalid padding");
	return utf8Decoder.decode(unpadded);
}
function hmacAad(key, message, aad) {
	if (aad.length !== 32)
		throw new Error("AAD associated data must be 32 bytes");
	const combined = concatBytes3(aad, message);
	return hmac2(sha2562, key, combined);
}
function decodePayload(payload) {
	if (typeof payload !== "string")
		throw new Error("payload must be a valid string");
	const plen = payload.length;
	if (plen < 132 || plen > 87472)
		throw new Error("invalid payload length: " + plen);
	if (payload[0] === "#") throw new Error("unknown encryption version");
	let data;
	try {
		data = base64.decode(payload);
	} catch (error) {
		throw new Error("invalid base64: " + error.message);
	}
	const dlen = data.length;
	if (dlen < 99 || dlen > 65603)
		throw new Error("invalid data length: " + dlen);
	const vers = data[0];
	if (vers !== 2) throw new Error("unknown encryption version " + vers);
	return {
		nonce: data.subarray(1, 33),
		ciphertext: data.subarray(33, -32),
		mac: data.subarray(-32),
	};
}
function encrypt22(plaintext, conversationKey, nonce = randomBytes2(32)) {
	const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(
		conversationKey,
		nonce,
	);
	const padded = pad(plaintext);
	const ciphertext = chacha20(chacha_key, chacha_nonce, padded);
	const mac = hmacAad(hmac_key, ciphertext, nonce);
	return base64.encode(
		concatBytes3(new Uint8Array([2]), nonce, ciphertext, mac),
	);
}
function decrypt22(payload, conversationKey) {
	const { nonce, ciphertext, mac } = decodePayload(payload);
	const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(
		conversationKey,
		nonce,
	);
	const calculatedMac = hmacAad(hmac_key, ciphertext, nonce);
	if (!equalBytes2(calculatedMac, mac)) throw new Error("invalid MAC");
	const padded = chacha20(chacha_key, chacha_nonce, ciphertext);
	return unpad(padded);
}
var v2 = {
	utils: {
		getConversationKey,
		calcPaddedLen,
	},
	encrypt: encrypt22,
	decrypt: decrypt22,
};
var TWO_DAYS = 2 * 24 * 60 * 60;
var now = () => Math.round(Date.now() / 1000);
var randomNow = () => Math.round(now() - Math.random() * TWO_DAYS);
var nip44ConversationKey = (privateKey, publicKey) =>
	getConversationKey(privateKey, publicKey);
var nip44Encrypt = (data, privateKey, publicKey) =>
	encrypt22(JSON.stringify(data), nip44ConversationKey(privateKey, publicKey));
var nip44Decrypt = (data, privateKey) =>
	JSON.parse(
		decrypt22(data.content, nip44ConversationKey(privateKey, data.pubkey)),
	);
function createRumor(event, privateKey) {
	const rumor = {
		created_at: now(),
		content: "",
		tags: [],
		...event,
		pubkey: getPublicKey(privateKey),
	};
	rumor.id = getEventHash(rumor);
	return rumor;
}
function createSeal(rumor, privateKey, recipientPublicKey) {
	return finalizeEvent(
		{
			kind: Seal,
			content: nip44Encrypt(rumor, privateKey, recipientPublicKey),
			created_at: randomNow(),
			tags: [],
		},
		privateKey,
	);
}
function createWrap(seal, recipientPublicKey) {
	const randomKey = generateSecretKey();
	return finalizeEvent(
		{
			kind: GiftWrap,
			content: nip44Encrypt(seal, randomKey, recipientPublicKey),
			created_at: randomNow(),
			tags: [["p", recipientPublicKey]],
		},
		randomKey,
	);
}
function wrapEvent(event, senderPrivateKey, recipientPublicKey) {
	const rumor = createRumor(event, senderPrivateKey);
	const seal = createSeal(rumor, senderPrivateKey, recipientPublicKey);
	return createWrap(seal, recipientPublicKey);
}
function wrapManyEvents(event, senderPrivateKey, recipientsPublicKeys) {
	if (!recipientsPublicKeys || recipientsPublicKeys.length === 0) {
		throw new Error("At least one recipient is required.");
	}
	const senderPublicKey = getPublicKey(senderPrivateKey);
	const wrappeds = [wrapEvent(event, senderPrivateKey, senderPublicKey)];
	recipientsPublicKeys.forEach((recipientPublicKey) => {
		wrappeds.push(wrapEvent(event, senderPrivateKey, recipientPublicKey));
	});
	return wrappeds;
}
function unwrapEvent(wrap, recipientPrivateKey) {
	const unwrappedSeal = nip44Decrypt(wrap, recipientPrivateKey);
	return nip44Decrypt(unwrappedSeal, recipientPrivateKey);
}
function unwrapManyEvents(wrappedEvents, recipientPrivateKey) {
	const unwrappedEvents = [];
	wrappedEvents.forEach((e) => {
		unwrappedEvents.push(unwrapEvent(e, recipientPrivateKey));
	});
	unwrappedEvents.sort((a, b) => a.created_at - b.created_at);
	return unwrappedEvents;
}
function createEvent(recipients, message, conversationTitle, replyTo) {
	const baseEvent = {
		created_at: Math.ceil(Date.now() / 1000),
		kind: PrivateDirectMessage,
		tags: [],
		content: message,
	};
	const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];
	recipientsArray.forEach(({ publicKey, relayUrl }) => {
		baseEvent.tags.push(
			relayUrl ? ["p", publicKey, relayUrl] : ["p", publicKey],
		);
	});
	if (replyTo) {
		baseEvent.tags.push([
			"e",
			replyTo.eventId,
			replyTo.relayUrl || "",
			"reply",
		]);
	}
	if (conversationTitle) {
		baseEvent.tags.push(["subject", conversationTitle]);
	}
	return baseEvent;
}
function wrapEvent2(
	senderPrivateKey,
	recipient,
	message,
	conversationTitle,
	replyTo,
) {
	const event = createEvent(recipient, message, conversationTitle, replyTo);
	return wrapEvent(event, senderPrivateKey, recipient.publicKey);
}
function wrapManyEvents2(
	senderPrivateKey,
	recipients,
	message,
	conversationTitle,
	replyTo,
) {
	if (!recipients || recipients.length === 0) {
		throw new Error("At least one recipient is required.");
	}
	const senderPublicKey = getPublicKey(senderPrivateKey);
	return [{ publicKey: senderPublicKey }, ...recipients].map((recipient) =>
		wrapEvent2(
			senderPrivateKey,
			recipient,
			message,
			conversationTitle,
			replyTo,
		),
	);
}
var unwrapEvent2 = unwrapEvent;
var unwrapManyEvents2 = unwrapManyEvents;
var nip18_exports = {};
__export2(nip18_exports, {
	finishRepostEvent: () => finishRepostEvent,
	getRepostedEvent: () => getRepostedEvent,
	getRepostedEventPointer: () => getRepostedEventPointer,
});
function finishRepostEvent(t, reposted, relayUrl, privateKey) {
	let kind;
	const tags = [
		...(t.tags ?? []),
		["e", reposted.id, relayUrl],
		["p", reposted.pubkey],
	];
	if (reposted.kind === ShortTextNote) {
		kind = Repost;
	} else {
		kind = GenericRepost;
		tags.push(["k", String(reposted.kind)]);
	}
	return finalizeEvent(
		{
			kind,
			tags,
			content:
				t.content === "" || reposted.tags?.find((tag) => tag[0] === "-")
					? ""
					: JSON.stringify(reposted),
			created_at: t.created_at,
		},
		privateKey,
	);
}
function getRepostedEventPointer(event) {
	if (![Repost, GenericRepost].includes(event.kind)) {
		return;
	}
	let lastETag;
	let lastPTag;
	for (
		let i2 = event.tags.length - 1;
		i2 >= 0 && (lastETag === undefined || lastPTag === undefined);
		i2--
	) {
		const tag = event.tags[i2];
		if (tag.length >= 2) {
			if (tag[0] === "e" && lastETag === undefined) {
				lastETag = tag;
			} else if (tag[0] === "p" && lastPTag === undefined) {
				lastPTag = tag;
			}
		}
	}
	if (lastETag === undefined) {
		return;
	}
	return {
		id: lastETag[1],
		relays: [lastETag[2], lastPTag?.[2]].filter((x) => typeof x === "string"),
		author: lastPTag?.[1],
	};
}
function getRepostedEvent(event, { skipVerification } = {}) {
	const pointer = getRepostedEventPointer(event);
	if (pointer === undefined || event.content === "") {
		return;
	}
	let repostedEvent;
	try {
		repostedEvent = JSON.parse(event.content);
	} catch (error) {
		return;
	}
	if (repostedEvent.id !== pointer.id) {
		return;
	}
	if (!skipVerification && !verifyEvent(repostedEvent)) {
		return;
	}
	return repostedEvent;
}
var nip21_exports = {};
__export2(nip21_exports, {
	NOSTR_URI_REGEX: () => NOSTR_URI_REGEX,
	parse: () => parse2,
	test: () => test,
});
var NOSTR_URI_REGEX = new RegExp(`nostr:(${BECH32_REGEX.source})`);
function test(value) {
	return (
		typeof value === "string" &&
		new RegExp(`^${NOSTR_URI_REGEX.source}$`).test(value)
	);
}
function parse2(uri) {
	const match = uri.match(new RegExp(`^${NOSTR_URI_REGEX.source}$`));
	if (!match) throw new Error(`Invalid Nostr URI: ${uri}`);
	return {
		uri: match[0],
		value: match[1],
		decoded: decode(match[1]),
	};
}
var nip25_exports = {};
__export2(nip25_exports, {
	finishReactionEvent: () => finishReactionEvent,
	getReactedEventPointer: () => getReactedEventPointer,
});
function finishReactionEvent(t, reacted, privateKey) {
	const inheritedTags = reacted.tags.filter(
		(tag) => tag.length >= 2 && (tag[0] === "e" || tag[0] === "p"),
	);
	return finalizeEvent(
		{
			...t,
			kind: Reaction,
			tags: [
				...(t.tags ?? []),
				...inheritedTags,
				["e", reacted.id],
				["p", reacted.pubkey],
			],
			content: t.content ?? "+",
		},
		privateKey,
	);
}
function getReactedEventPointer(event) {
	if (event.kind !== Reaction) {
		return;
	}
	let lastETag;
	let lastPTag;
	for (
		let i2 = event.tags.length - 1;
		i2 >= 0 && (lastETag === undefined || lastPTag === undefined);
		i2--
	) {
		const tag = event.tags[i2];
		if (tag.length >= 2) {
			if (tag[0] === "e" && lastETag === undefined) {
				lastETag = tag;
			} else if (tag[0] === "p" && lastPTag === undefined) {
				lastPTag = tag;
			}
		}
	}
	if (lastETag === undefined || lastPTag === undefined) {
		return;
	}
	return {
		id: lastETag[1],
		relays: [lastETag[2], lastPTag[2]].filter((x) => x !== undefined),
		author: lastPTag[1],
	};
}
var nip27_exports = {};
__export2(nip27_exports, {
	parse: () => parse3,
});
var noCharacter = /\W/m;
var noURLCharacter = /\W |\W$|$|,| /m;
function* parse3(content) {
	const max = content.length;
	let prevIndex = 0;
	let index = 0;
	while (index < max) {
		const u = content.indexOf(":", index);
		if (u === -1) {
			break;
		}
		if (content.substring(u - 5, u) === "nostr") {
			const m = content.substring(u + 60).match(noCharacter);
			const end = m ? u + 60 + m.index : max;
			try {
				let pointer;
				const { data, type } = decode(content.substring(u + 1, end));
				switch (type) {
					case "npub":
						pointer = { pubkey: data };
						break;
					case "nsec":
					case "note":
						index = end + 1;
						continue;
					default:
						pointer = data;
				}
				if (prevIndex !== u - 5) {
					yield { type: "text", text: content.substring(prevIndex, u - 5) };
				}
				yield { type: "reference", pointer };
				index = end;
				prevIndex = index;
				continue;
			} catch (_err) {
				index = u + 1;
				continue;
			}
		} else if (
			content.substring(u - 5, u) === "https" ||
			content.substring(u - 4, u) === "http"
		) {
			const m = content.substring(u + 4).match(noURLCharacter);
			const end = m ? u + 4 + m.index : max;
			const prefixLen = content[u - 1] === "s" ? 5 : 4;
			try {
				const url = new URL(content.substring(u - prefixLen, end));
				if (url.hostname.indexOf(".") === -1) {
					throw new Error("invalid url");
				}
				if (prevIndex !== u - prefixLen) {
					yield {
						type: "text",
						text: content.substring(prevIndex, u - prefixLen),
					};
				}
				if (
					url.pathname.endsWith(".png") ||
					url.pathname.endsWith(".jpg") ||
					url.pathname.endsWith(".jpeg") ||
					url.pathname.endsWith(".gif") ||
					url.pathname.endsWith(".webp")
				) {
					yield { type: "image", url: url.toString() };
					index = end;
					prevIndex = index;
					continue;
				}
				if (
					url.pathname.endsWith(".mp4") ||
					url.pathname.endsWith(".avi") ||
					url.pathname.endsWith(".webm") ||
					url.pathname.endsWith(".mkv")
				) {
					yield { type: "video", url: url.toString() };
					index = end;
					prevIndex = index;
					continue;
				}
				if (
					url.pathname.endsWith(".mp3") ||
					url.pathname.endsWith(".aac") ||
					url.pathname.endsWith(".ogg") ||
					url.pathname.endsWith(".opus")
				) {
					yield { type: "audio", url: url.toString() };
					index = end;
					prevIndex = index;
					continue;
				}
				yield { type: "url", url: url.toString() };
				index = end;
				prevIndex = index;
				continue;
			} catch (_err) {
				index = end + 1;
				continue;
			}
		} else if (
			content.substring(u - 3, u) === "wss" ||
			content.substring(u - 2, u) === "ws"
		) {
			const m = content.substring(u + 4).match(noURLCharacter);
			const end = m ? u + 4 + m.index : max;
			const prefixLen = content[u - 1] === "s" ? 3 : 2;
			try {
				const url = new URL(content.substring(u - prefixLen, end));
				if (url.hostname.indexOf(".") === -1) {
					throw new Error("invalid ws url");
				}
				if (prevIndex !== u - prefixLen) {
					yield {
						type: "text",
						text: content.substring(prevIndex, u - prefixLen),
					};
				}
				yield { type: "relay", url: url.toString() };
				index = end;
				prevIndex = index;
				continue;
			} catch (_err) {
				index = end + 1;
				continue;
			}
		} else {
			index = u + 1;
			continue;
		}
	}
	if (prevIndex !== max) {
		yield { type: "text", text: content.substring(prevIndex) };
	}
}
var nip28_exports = {};
__export2(nip28_exports, {
	channelCreateEvent: () => channelCreateEvent,
	channelHideMessageEvent: () => channelHideMessageEvent,
	channelMessageEvent: () => channelMessageEvent,
	channelMetadataEvent: () => channelMetadataEvent,
	channelMuteUserEvent: () => channelMuteUserEvent,
});
var channelCreateEvent = (t, privateKey) => {
	let content;
	if (typeof t.content === "object") {
		content = JSON.stringify(t.content);
	} else if (typeof t.content === "string") {
		content = t.content;
	} else {
		return;
	}
	return finalizeEvent(
		{
			kind: ChannelCreation,
			tags: [...(t.tags ?? [])],
			content,
			created_at: t.created_at,
		},
		privateKey,
	);
};
var channelMetadataEvent = (t, privateKey) => {
	let content;
	if (typeof t.content === "object") {
		content = JSON.stringify(t.content);
	} else if (typeof t.content === "string") {
		content = t.content;
	} else {
		return;
	}
	return finalizeEvent(
		{
			kind: ChannelMetadata,
			tags: [["e", t.channel_create_event_id], ...(t.tags ?? [])],
			content,
			created_at: t.created_at,
		},
		privateKey,
	);
};
var channelMessageEvent = (t, privateKey) => {
	const tags = [["e", t.channel_create_event_id, t.relay_url, "root"]];
	if (t.reply_to_channel_message_event_id) {
		tags.push(["e", t.reply_to_channel_message_event_id, t.relay_url, "reply"]);
	}
	return finalizeEvent(
		{
			kind: ChannelMessage,
			tags: [...tags, ...(t.tags ?? [])],
			content: t.content,
			created_at: t.created_at,
		},
		privateKey,
	);
};
var channelHideMessageEvent = (t, privateKey) => {
	let content;
	if (typeof t.content === "object") {
		content = JSON.stringify(t.content);
	} else if (typeof t.content === "string") {
		content = t.content;
	} else {
		return;
	}
	return finalizeEvent(
		{
			kind: ChannelHideMessage,
			tags: [["e", t.channel_message_event_id], ...(t.tags ?? [])],
			content,
			created_at: t.created_at,
		},
		privateKey,
	);
};
var channelMuteUserEvent = (t, privateKey) => {
	let content;
	if (typeof t.content === "object") {
		content = JSON.stringify(t.content);
	} else if (typeof t.content === "string") {
		content = t.content;
	} else {
		return;
	}
	return finalizeEvent(
		{
			kind: ChannelMuteUser,
			tags: [["p", t.pubkey_to_mute], ...(t.tags ?? [])],
			content,
			created_at: t.created_at,
		},
		privateKey,
	);
};
var nip30_exports = {};
__export2(nip30_exports, {
	EMOJI_SHORTCODE_REGEX: () => EMOJI_SHORTCODE_REGEX,
	matchAll: () => matchAll,
	regex: () => regex,
	replaceAll: () => replaceAll,
});
var EMOJI_SHORTCODE_REGEX = /:(\w+):/;
var regex = () => new RegExp(`\\B${EMOJI_SHORTCODE_REGEX.source}\\B`, "g");
function* matchAll(content) {
	const matches = content.matchAll(regex());
	for (const match of matches) {
		try {
			const [shortcode, name] = match;
			yield {
				shortcode,
				name,
				start: match.index,
				end: match.index + shortcode.length,
			};
		} catch (_e) {}
	}
}
function replaceAll(content, replacer) {
	return content.replaceAll(regex(), (shortcode, name) => {
		return replacer({
			shortcode,
			name,
		});
	});
}
var nip39_exports = {};
__export2(nip39_exports, {
	useFetchImplementation: () => useFetchImplementation3,
	validateGithub: () => validateGithub,
});
var _fetch3;
try {
	_fetch3 = fetch;
} catch {}
function useFetchImplementation3(fetchImplementation) {
	_fetch3 = fetchImplementation;
}
async function validateGithub(pubkey, username, proof) {
	try {
		const res = await (
			await _fetch3(`https://gist.github.com/${username}/${proof}/raw`)
		).text();
		return (
			res ===
			`Verifying that I control the following Nostr public key: ${pubkey}`
		);
	} catch (_) {
		return false;
	}
}
var nip47_exports = {};
__export2(nip47_exports, {
	makeNwcRequestEvent: () => makeNwcRequestEvent,
	parseConnectionString: () => parseConnectionString,
});
function parseConnectionString(connectionString) {
	const { pathname, searchParams } = new URL(connectionString);
	const pubkey = pathname;
	const relay = searchParams.get("relay");
	const secret = searchParams.get("secret");
	if (!pubkey || !relay || !secret) {
		throw new Error("invalid connection string");
	}
	return { pubkey, relay, secret };
}
async function makeNwcRequestEvent(pubkey, secretKey, invoice) {
	const content = {
		method: "pay_invoice",
		params: {
			invoice,
		},
	};
	const encryptedContent = encrypt2(secretKey, pubkey, JSON.stringify(content));
	const eventTemplate = {
		kind: NWCWalletRequest,
		created_at: Math.round(Date.now() / 1000),
		content: encryptedContent,
		tags: [["p", pubkey]],
	};
	return finalizeEvent(eventTemplate, secretKey);
}
var nip54_exports = {};
__export2(nip54_exports, {
	normalizeIdentifier: () => normalizeIdentifier,
});
function normalizeIdentifier(name) {
	name = name.trim().toLowerCase();
	name = name.normalize("NFKC");
	return Array.from(name)
		.map((char) => {
			if (/\p{Letter}/u.test(char) || /\p{Number}/u.test(char)) {
				return char;
			}
			return "-";
		})
		.join("");
}
var nip57_exports = {};
__export2(nip57_exports, {
	getSatoshisAmountFromBolt11: () => getSatoshisAmountFromBolt11,
	getZapEndpoint: () => getZapEndpoint,
	makeZapReceipt: () => makeZapReceipt,
	makeZapRequest: () => makeZapRequest,
	useFetchImplementation: () => useFetchImplementation4,
	validateZapRequest: () => validateZapRequest,
});
var _fetch4;
try {
	_fetch4 = fetch;
} catch {}
function useFetchImplementation4(fetchImplementation) {
	_fetch4 = fetchImplementation;
}
async function getZapEndpoint(metadata) {
	try {
		let lnurl = "";
		const { lud06, lud16 } = JSON.parse(metadata.content);
		if (lud06) {
			const { words } = bech32.decode(lud06, 1000);
			const data = bech32.fromWords(words);
			lnurl = utf8Decoder.decode(data);
		} else if (lud16) {
			const [name, domain] = lud16.split("@");
			lnurl = new URL(
				`/.well-known/lnurlp/${name}`,
				`https://${domain}`,
			).toString();
		} else {
			return null;
		}
		const res = await _fetch4(lnurl);
		const body = await res.json();
		if (body.allowsNostr && body.nostrPubkey) {
			return body.callback;
		}
	} catch (err) {}
	return null;
}
function makeZapRequest({ profile, event, amount, relays, comment = "" }) {
	if (!amount) throw new Error("amount not given");
	if (!profile) throw new Error("profile not given");
	const zr = {
		kind: 9734,
		created_at: Math.round(Date.now() / 1000),
		content: comment,
		tags: [
			["p", profile],
			["amount", amount.toString()],
			["relays", ...relays],
		],
	};
	if (event && typeof event === "string") {
		zr.tags.push(["e", event]);
	}
	if (event && typeof event === "object") {
		if (isReplaceableKind(event.kind)) {
			const a = ["a", `${event.kind}:${event.pubkey}:`];
			zr.tags.push(a);
		} else if (isAddressableKind(event.kind)) {
			const d = event.tags.find(([t, v]) => t === "d" && v);
			if (!d) throw new Error("d tag not found or is empty");
			const a = ["a", `${event.kind}:${event.pubkey}:${d[1]}`];
			zr.tags.push(a);
		}
	}
	return zr;
}
function validateZapRequest(zapRequestString) {
	let zapRequest;
	try {
		zapRequest = JSON.parse(zapRequestString);
	} catch (err) {
		return "Invalid zap request JSON.";
	}
	if (!validateEvent(zapRequest))
		return "Zap request is not a valid Nostr event.";
	if (!verifyEvent(zapRequest)) return "Invalid signature on zap request.";
	const p = zapRequest.tags.find(([t, v]) => t === "p" && v);
	if (!p) return "Zap request doesn't have a 'p' tag.";
	if (!p[1].match(/^[a-f0-9]{64}$/))
		return "Zap request 'p' tag is not valid hex.";
	const e = zapRequest.tags.find(([t, v]) => t === "e" && v);
	if (e && !e[1].match(/^[a-f0-9]{64}$/))
		return "Zap request 'e' tag is not valid hex.";
	const relays = zapRequest.tags.find(([t, v]) => t === "relays" && v);
	if (!relays) return "Zap request doesn't have a 'relays' tag.";
	return null;
}
function makeZapReceipt({ zapRequest, preimage, bolt11, paidAt }) {
	const zr = JSON.parse(zapRequest);
	const tagsFromZapRequest = zr.tags.filter(
		([t]) => t === "e" || t === "p" || t === "a",
	);
	const zap = {
		kind: 9735,
		created_at: Math.round(paidAt.getTime() / 1000),
		content: "",
		tags: [
			...tagsFromZapRequest,
			["P", zr.pubkey],
			["bolt11", bolt11],
			["description", zapRequest],
		],
	};
	if (preimage) {
		zap.tags.push(["preimage", preimage]);
	}
	return zap;
}
function getSatoshisAmountFromBolt11(bolt11) {
	if (bolt11.length < 50) {
		return 0;
	}
	bolt11 = bolt11.substring(0, 50);
	const idx = bolt11.lastIndexOf("1");
	if (idx === -1) {
		return 0;
	}
	const hrp = bolt11.substring(0, idx);
	if (!hrp.startsWith("lnbc")) {
		return 0;
	}
	const amount = hrp.substring(4);
	if (amount.length < 1) {
		return 0;
	}
	const char = amount[amount.length - 1];
	const digit = char.charCodeAt(0) - 48;
	const isDigit = digit >= 0 && digit <= 9;
	let cutPoint = amount.length - 1;
	if (isDigit) {
		cutPoint++;
	}
	if (cutPoint < 1) {
		return 0;
	}
	const num = Number.parseInt(amount.substring(0, cutPoint));
	switch (char) {
		case "m":
			return num * 1e5;
		case "u":
			return num * 100;
		case "n":
			return num / 10;
		case "p":
			return num / 1e4;
		default:
			return num * 1e8;
	}
}
var nip98_exports = {};
__export2(nip98_exports, {
	getToken: () => getToken,
	hashPayload: () => hashPayload,
	unpackEventFromToken: () => unpackEventFromToken,
	validateEvent: () => validateEvent2,
	validateEventKind: () => validateEventKind,
	validateEventMethodTag: () => validateEventMethodTag,
	validateEventPayloadTag: () => validateEventPayloadTag,
	validateEventTimestamp: () => validateEventTimestamp,
	validateEventUrlTag: () => validateEventUrlTag,
	validateToken: () => validateToken,
});
var _authorizationScheme = "Nostr ";
async function getToken(
	loginUrl,
	httpMethod,
	sign,
	includeAuthorizationScheme = false,
	payload,
) {
	const event = {
		kind: HTTPAuth,
		tags: [
			["u", loginUrl],
			["method", httpMethod],
		],
		created_at: Math.round(new Date().getTime() / 1000),
		content: "",
	};
	if (payload) {
		event.tags.push(["payload", hashPayload(payload)]);
	}
	const signedEvent = await sign(event);
	const authorizationScheme = includeAuthorizationScheme
		? _authorizationScheme
		: "";
	return (
		authorizationScheme +
		base64.encode(utf8Encoder.encode(JSON.stringify(signedEvent)))
	);
}
async function validateToken(token, url, method) {
	const event = await unpackEventFromToken(token).catch((error) => {
		throw error;
	});
	const valid = await validateEvent2(event, url, method).catch((error) => {
		throw error;
	});
	return valid;
}
async function unpackEventFromToken(token) {
	if (!token) {
		throw new Error("Missing token");
	}
	token = token.replace(_authorizationScheme, "");
	const eventB64 = utf8Decoder.decode(base64.decode(token));
	if (!eventB64 || eventB64.length === 0 || !eventB64.startsWith("{")) {
		throw new Error("Invalid token");
	}
	const event = JSON.parse(eventB64);
	return event;
}
function validateEventTimestamp(event) {
	if (!event.created_at) {
		return false;
	}
	return Math.round(new Date().getTime() / 1000) - event.created_at < 60;
}
function validateEventKind(event) {
	return event.kind === HTTPAuth;
}
function validateEventUrlTag(event, url) {
	const urlTag = event.tags.find((t) => t[0] === "u");
	if (!urlTag) {
		return false;
	}
	return urlTag.length > 0 && urlTag[1] === url;
}
function validateEventMethodTag(event, method) {
	const methodTag = event.tags.find((t) => t[0] === "method");
	if (!methodTag) {
		return false;
	}
	return (
		methodTag.length > 0 && methodTag[1].toLowerCase() === method.toLowerCase()
	);
}
function hashPayload(payload) {
	const hash3 = sha2562(utf8Encoder.encode(JSON.stringify(payload)));
	return bytesToHex2(hash3);
}
function validateEventPayloadTag(event, payload) {
	const payloadTag = event.tags.find((t) => t[0] === "payload");
	if (!payloadTag) {
		return false;
	}
	const payloadHash = hashPayload(payload);
	return payloadTag.length > 0 && payloadTag[1] === payloadHash;
}
async function validateEvent2(event, url, method, body) {
	if (!verifyEvent(event)) {
		throw new Error("Invalid nostr event, signature invalid");
	}
	if (!validateEventKind(event)) {
		throw new Error("Invalid nostr event, kind invalid");
	}
	if (!validateEventTimestamp(event)) {
		throw new Error("Invalid nostr event, created_at timestamp invalid");
	}
	if (!validateEventUrlTag(event, url)) {
		throw new Error("Invalid nostr event, url tag invalid");
	}
	if (!validateEventMethodTag(event, method)) {
		throw new Error("Invalid nostr event, method tag invalid");
	}
	if (
		Boolean(body) &&
		typeof body === "object" &&
		Object.keys(body).length > 0
	) {
		if (!validateEventPayloadTag(event, body)) {
			throw new Error(
				"Invalid nostr event, payload tag does not match request body hash",
			);
		}
	}
	return true;
}

// node_modules/@noble/hashes/esm/cryptoNode.js
import * as nc3 from "node:crypto";
var crypto3 =
	nc3 && typeof nc3 === "object" && "webcrypto" in nc3
		? nc3.webcrypto
		: nc3 && typeof nc3 === "object" && "randomBytes" in nc3
			? nc3
			: undefined;

// node_modules/@noble/hashes/esm/utils.js
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function isBytes2(a) {
	return (
		a instanceof Uint8Array ||
		(ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array")
	);
}
function anumber(n) {
	if (!Number.isSafeInteger(n) || n < 0)
		throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
	if (!isBytes2(b)) throw new Error("Uint8Array expected");
	if (lengths.length > 0 && !lengths.includes(b.length))
		throw new Error(
			"Uint8Array expected of length " + lengths + ", got length=" + b.length,
		);
}
function ahash(h) {
	if (typeof h !== "function" || typeof h.create !== "function")
		throw new Error("Hash should be wrapped by utils.createHasher");
	anumber(h.outputLen);
	anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
	if (instance.destroyed) throw new Error("Hash instance has been destroyed");
	if (checkFinished && instance.finished)
		throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
	abytes(out);
	const min = instance.outputLen;
	if (out.length < min) {
		throw new Error(
			"digestInto() expects output buffer of length at least " + min,
		);
	}
}
function clean(...arrays) {
	for (let i2 = 0; i2 < arrays.length; i2++) {
		arrays[i2].fill(0);
	}
}
function createView4(arr) {
	return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr3(word, shift) {
	return (word << (32 - shift)) | (word >>> shift);
}
var hasHexBuiltin = /* @__PURE__ */ (() =>
	typeof Uint8Array.from([]).toHex === "function" &&
	typeof Uint8Array.fromHex === "function")();
var hexes3 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) =>
	i2.toString(16).padStart(2, "0"),
);
function bytesToHex3(bytes4) {
	abytes(bytes4);
	if (hasHexBuiltin) return bytes4.toHex();
	let hex2 = "";
	for (let i2 = 0; i2 < bytes4.length; i2++) {
		hex2 += hexes3[bytes4[i2]];
	}
	return hex2;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
	if (ch >= asciis._0 && ch <= asciis._9) return ch - asciis._0;
	if (ch >= asciis.A && ch <= asciis.F) return ch - (asciis.A - 10);
	if (ch >= asciis.a && ch <= asciis.f) return ch - (asciis.a - 10);
	return;
}
function hexToBytes3(hex2) {
	if (typeof hex2 !== "string")
		throw new Error("hex string expected, got " + typeof hex2);
	if (hasHexBuiltin) return Uint8Array.fromHex(hex2);
	const hl = hex2.length;
	const al = hl / 2;
	if (hl % 2)
		throw new Error("hex string expected, got unpadded hex of length " + hl);
	const array = new Uint8Array(al);
	for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
		const n1 = asciiToBase16(hex2.charCodeAt(hi));
		const n2 = asciiToBase16(hex2.charCodeAt(hi + 1));
		if (n1 === undefined || n2 === undefined) {
			const char = hex2[hi] + hex2[hi + 1];
			throw new Error(
				'hex string expected, got non-hex character "' +
					char +
					'" at index ' +
					hi,
			);
		}
		array[ai] = n1 * 16 + n2;
	}
	return array;
}
function utf8ToBytes5(str) {
	if (typeof str !== "string") throw new Error("string expected");
	return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes4(data) {
	if (typeof data === "string") data = utf8ToBytes5(data);
	abytes(data);
	return data;
}
function concatBytes4(...arrays) {
	let sum = 0;
	for (let i2 = 0; i2 < arrays.length; i2++) {
		const a = arrays[i2];
		abytes(a);
		sum += a.length;
	}
	const res = new Uint8Array(sum);
	for (let i2 = 0, pad2 = 0; i2 < arrays.length; i2++) {
		const a = arrays[i2];
		res.set(a, pad2);
		pad2 += a.length;
	}
	return res;
}
class Hash3 {}
function createHasher(hashCons) {
	const hashC = (msg) => hashCons().update(toBytes4(msg)).digest();
	const tmp = hashCons();
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.create = () => hashCons();
	return hashC;
}
function randomBytes3(bytesLength = 32) {
	if (crypto3 && typeof crypto3.getRandomValues === "function") {
		return crypto3.getRandomValues(new Uint8Array(bytesLength));
	}
	if (crypto3 && typeof crypto3.randomBytes === "function") {
		return Uint8Array.from(crypto3.randomBytes(bytesLength));
	}
	throw new Error("crypto.getRandomValues must be defined");
}

// node_modules/@noble/hashes/esm/_md.js
function setBigUint644(view, byteOffset, value, isLE4) {
	if (typeof view.setBigUint64 === "function")
		return view.setBigUint64(byteOffset, value, isLE4);
	const _32n = BigInt(32);
	const _u32_max = BigInt(4294967295);
	const wh = Number((value >> _32n) & _u32_max);
	const wl = Number(value & _u32_max);
	const h = isLE4 ? 4 : 0;
	const l = isLE4 ? 0 : 4;
	view.setUint32(byteOffset + h, wh, isLE4);
	view.setUint32(byteOffset + l, wl, isLE4);
}
function Chi3(a, b, c) {
	return (a & b) ^ (~a & c);
}
function Maj3(a, b, c) {
	return (a & b) ^ (a & c) ^ (b & c);
}

class HashMD extends Hash3 {
	constructor(blockLen, outputLen, padOffset, isLE4) {
		super();
		this.finished = false;
		this.length = 0;
		this.pos = 0;
		this.destroyed = false;
		this.blockLen = blockLen;
		this.outputLen = outputLen;
		this.padOffset = padOffset;
		this.isLE = isLE4;
		this.buffer = new Uint8Array(blockLen);
		this.view = createView4(this.buffer);
	}
	update(data) {
		aexists(this);
		data = toBytes4(data);
		abytes(data);
		const { view, buffer, blockLen } = this;
		const len = data.length;
		for (let pos = 0; pos < len; ) {
			const take = Math.min(blockLen - this.pos, len - pos);
			if (take === blockLen) {
				const dataView = createView4(data);
				for (; blockLen <= len - pos; pos += blockLen)
					this.process(dataView, pos);
				continue;
			}
			buffer.set(data.subarray(pos, pos + take), this.pos);
			this.pos += take;
			pos += take;
			if (this.pos === blockLen) {
				this.process(view, 0);
				this.pos = 0;
			}
		}
		this.length += data.length;
		this.roundClean();
		return this;
	}
	digestInto(out) {
		aexists(this);
		aoutput(out, this);
		this.finished = true;
		const { buffer, view, blockLen, isLE: isLE4 } = this;
		let { pos } = this;
		buffer[pos++] = 128;
		clean(this.buffer.subarray(pos));
		if (this.padOffset > blockLen - pos) {
			this.process(view, 0);
			pos = 0;
		}
		for (let i2 = pos; i2 < blockLen; i2++) buffer[i2] = 0;
		setBigUint644(view, blockLen - 8, BigInt(this.length * 8), isLE4);
		this.process(view, 0);
		const oview = createView4(out);
		const len = this.outputLen;
		if (len % 4) throw new Error("_sha2: outputLen should be aligned to 32bit");
		const outLen = len / 4;
		const state = this.get();
		if (outLen > state.length)
			throw new Error("_sha2: outputLen bigger than state");
		for (let i2 = 0; i2 < outLen; i2++)
			oview.setUint32(4 * i2, state[i2], isLE4);
	}
	digest() {
		const { buffer, outputLen } = this;
		this.digestInto(buffer);
		const res = buffer.slice(0, outputLen);
		this.destroy();
		return res;
	}
	_cloneInto(to) {
		to || (to = new this.constructor());
		to.set(...this.get());
		const { blockLen, buffer, length, finished, destroyed, pos } = this;
		to.destroyed = destroyed;
		to.finished = finished;
		to.length = length;
		to.pos = pos;
		if (length % blockLen) to.buffer.set(buffer);
		return to;
	}
	clone() {
		return this._cloneInto();
	}
}
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
	1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
	528734635, 1541459225,
]);

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K3 = /* @__PURE__ */ Uint32Array.from([
	1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
	2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
	1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
	264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
	2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
	113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
	1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
	3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
	430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063,
	1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474,
	2756734187, 3204031479, 3329325298,
]);
var SHA256_W3 = /* @__PURE__ */ new Uint32Array(64);

class SHA2563 extends HashMD {
	constructor(outputLen = 32) {
		super(64, outputLen, 8, false);
		this.A = SHA256_IV[0] | 0;
		this.B = SHA256_IV[1] | 0;
		this.C = SHA256_IV[2] | 0;
		this.D = SHA256_IV[3] | 0;
		this.E = SHA256_IV[4] | 0;
		this.F = SHA256_IV[5] | 0;
		this.G = SHA256_IV[6] | 0;
		this.H = SHA256_IV[7] | 0;
	}
	get() {
		const { A, B, C, D, E, F, G, H } = this;
		return [A, B, C, D, E, F, G, H];
	}
	set(A, B, C, D, E, F, G, H) {
		this.A = A | 0;
		this.B = B | 0;
		this.C = C | 0;
		this.D = D | 0;
		this.E = E | 0;
		this.F = F | 0;
		this.G = G | 0;
		this.H = H | 0;
	}
	process(view, offset) {
		for (let i2 = 0; i2 < 16; i2++, offset += 4)
			SHA256_W3[i2] = view.getUint32(offset, false);
		for (let i2 = 16; i2 < 64; i2++) {
			const W15 = SHA256_W3[i2 - 15];
			const W2 = SHA256_W3[i2 - 2];
			const s0 = rotr3(W15, 7) ^ rotr3(W15, 18) ^ (W15 >>> 3);
			const s1 = rotr3(W2, 17) ^ rotr3(W2, 19) ^ (W2 >>> 10);
			SHA256_W3[i2] = (s1 + SHA256_W3[i2 - 7] + s0 + SHA256_W3[i2 - 16]) | 0;
		}
		let { A, B, C, D, E, F, G, H } = this;
		for (let i2 = 0; i2 < 64; i2++) {
			const sigma1 = rotr3(E, 6) ^ rotr3(E, 11) ^ rotr3(E, 25);
			const T1 =
				(H + sigma1 + Chi3(E, F, G) + SHA256_K3[i2] + SHA256_W3[i2]) | 0;
			const sigma0 = rotr3(A, 2) ^ rotr3(A, 13) ^ rotr3(A, 22);
			const T2 = (sigma0 + Maj3(A, B, C)) | 0;
			H = G;
			G = F;
			F = E;
			E = (D + T1) | 0;
			D = C;
			C = B;
			B = A;
			A = (T1 + T2) | 0;
		}
		A = (A + this.A) | 0;
		B = (B + this.B) | 0;
		C = (C + this.C) | 0;
		D = (D + this.D) | 0;
		E = (E + this.E) | 0;
		F = (F + this.F) | 0;
		G = (G + this.G) | 0;
		H = (H + this.H) | 0;
		this.set(A, B, C, D, E, F, G, H);
	}
	roundClean() {
		clean(SHA256_W3);
	}
	destroy() {
		this.set(0, 0, 0, 0, 0, 0, 0, 0);
		clean(this.buffer);
	}
}
var sha2563 = /* @__PURE__ */ createHasher(() => new SHA2563());

// node_modules/@noble/hashes/esm/hmac.js
class HMAC3 extends Hash3 {
	constructor(hash3, _key) {
		super();
		this.finished = false;
		this.destroyed = false;
		ahash(hash3);
		const key = toBytes4(_key);
		this.iHash = hash3.create();
		if (typeof this.iHash.update !== "function")
			throw new Error("Expected instance of class which extends utils.Hash");
		this.blockLen = this.iHash.blockLen;
		this.outputLen = this.iHash.outputLen;
		const blockLen = this.blockLen;
		const pad2 = new Uint8Array(blockLen);
		pad2.set(key.length > blockLen ? hash3.create().update(key).digest() : key);
		for (let i2 = 0; i2 < pad2.length; i2++) pad2[i2] ^= 54;
		this.iHash.update(pad2);
		this.oHash = hash3.create();
		for (let i2 = 0; i2 < pad2.length; i2++) pad2[i2] ^= 54 ^ 92;
		this.oHash.update(pad2);
		clean(pad2);
	}
	update(buf) {
		aexists(this);
		this.iHash.update(buf);
		return this;
	}
	digestInto(out) {
		aexists(this);
		abytes(out, this.outputLen);
		this.finished = true;
		this.iHash.digestInto(out);
		this.oHash.update(out);
		this.oHash.digestInto(out);
		this.destroy();
	}
	digest() {
		const out = new Uint8Array(this.oHash.outputLen);
		this.digestInto(out);
		return out;
	}
	_cloneInto(to) {
		to || (to = Object.create(Object.getPrototypeOf(this), {}));
		const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
		to = to;
		to.finished = finished;
		to.destroyed = destroyed;
		to.blockLen = blockLen;
		to.outputLen = outputLen;
		to.oHash = oHash._cloneInto(to.oHash);
		to.iHash = iHash._cloneInto(to.iHash);
		return to;
	}
	clone() {
		return this._cloneInto();
	}
	destroy() {
		this.destroyed = true;
		this.oHash.destroy();
		this.iHash.destroy();
	}
}
var hmac3 = (hash3, key, message) =>
	new HMAC3(hash3, key).update(message).digest();
hmac3.create = (hash3, key) => new HMAC3(hash3, key);

// node_modules/@noble/curves/esm/abstract/utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n6 = /* @__PURE__ */ BigInt(0);
var _1n6 = /* @__PURE__ */ BigInt(1);
function isBytes3(a) {
	return (
		a instanceof Uint8Array ||
		(ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array")
	);
}
function abytes2(item) {
	if (!isBytes3(item)) throw new Error("Uint8Array expected");
}
function abool(title, value) {
	if (typeof value !== "boolean")
		throw new Error(title + " boolean expected, got " + value);
}
function numberToHexUnpadded2(num) {
	const hex2 = num.toString(16);
	return hex2.length & 1 ? "0" + hex2 : hex2;
}
function hexToNumber2(hex2) {
	if (typeof hex2 !== "string")
		throw new Error("hex string expected, got " + typeof hex2);
	return hex2 === "" ? _0n6 : BigInt("0x" + hex2);
}
var hasHexBuiltin2 =
	typeof Uint8Array.from([]).toHex === "function" &&
	typeof Uint8Array.fromHex === "function";
var hexes4 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) =>
	i2.toString(16).padStart(2, "0"),
);
function bytesToHex4(bytes4) {
	abytes2(bytes4);
	if (hasHexBuiltin2) return bytes4.toHex();
	let hex2 = "";
	for (let i2 = 0; i2 < bytes4.length; i2++) {
		hex2 += hexes4[bytes4[i2]];
	}
	return hex2;
}
var asciis2 = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase162(ch) {
	if (ch >= asciis2._0 && ch <= asciis2._9) return ch - asciis2._0;
	if (ch >= asciis2.A && ch <= asciis2.F) return ch - (asciis2.A - 10);
	if (ch >= asciis2.a && ch <= asciis2.f) return ch - (asciis2.a - 10);
	return;
}
function hexToBytes4(hex2) {
	if (typeof hex2 !== "string")
		throw new Error("hex string expected, got " + typeof hex2);
	if (hasHexBuiltin2) return Uint8Array.fromHex(hex2);
	const hl = hex2.length;
	const al = hl / 2;
	if (hl % 2)
		throw new Error("hex string expected, got unpadded hex of length " + hl);
	const array = new Uint8Array(al);
	for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
		const n1 = asciiToBase162(hex2.charCodeAt(hi));
		const n2 = asciiToBase162(hex2.charCodeAt(hi + 1));
		if (n1 === undefined || n2 === undefined) {
			const char = hex2[hi] + hex2[hi + 1];
			throw new Error(
				'hex string expected, got non-hex character "' +
					char +
					'" at index ' +
					hi,
			);
		}
		array[ai] = n1 * 16 + n2;
	}
	return array;
}
function bytesToNumberBE2(bytes4) {
	return hexToNumber2(bytesToHex4(bytes4));
}
function bytesToNumberLE2(bytes4) {
	abytes2(bytes4);
	return hexToNumber2(bytesToHex4(Uint8Array.from(bytes4).reverse()));
}
function numberToBytesBE2(n, len) {
	return hexToBytes4(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE2(n, len) {
	return numberToBytesBE2(n, len).reverse();
}
function ensureBytes2(title, hex2, expectedLength) {
	let res;
	if (typeof hex2 === "string") {
		try {
			res = hexToBytes4(hex2);
		} catch (e) {
			throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
		}
	} else if (isBytes3(hex2)) {
		res = Uint8Array.from(hex2);
	} else {
		throw new Error(title + " must be hex string or Uint8Array");
	}
	const len = res.length;
	if (typeof expectedLength === "number" && len !== expectedLength)
		throw new Error(
			title + " of length " + expectedLength + " expected, got " + len,
		);
	return res;
}
function concatBytes5(...arrays) {
	let sum = 0;
	for (let i2 = 0; i2 < arrays.length; i2++) {
		const a = arrays[i2];
		abytes2(a);
		sum += a.length;
	}
	const res = new Uint8Array(sum);
	for (let i2 = 0, pad2 = 0; i2 < arrays.length; i2++) {
		const a = arrays[i2];
		res.set(a, pad2);
		pad2 += a.length;
	}
	return res;
}
var isPosBig = (n) => typeof n === "bigint" && _0n6 <= n;
function inRange(n, min, max) {
	return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
	if (!inRange(n, min, max))
		throw new Error(
			"expected valid " + title + ": " + min + " <= n < " + max + ", got " + n,
		);
}
function bitLen2(n) {
	let len;
	for (len = 0; n > _0n6; n >>= _1n6, len += 1);
	return len;
}
var bitMask2 = (n) => (_1n6 << BigInt(n)) - _1n6;
var u8n2 = (len) => new Uint8Array(len);
var u8fr2 = (arr) => Uint8Array.from(arr);
function createHmacDrbg2(hashLen, qByteLen, hmacFn) {
	if (typeof hashLen !== "number" || hashLen < 2)
		throw new Error("hashLen must be a number");
	if (typeof qByteLen !== "number" || qByteLen < 2)
		throw new Error("qByteLen must be a number");
	if (typeof hmacFn !== "function")
		throw new Error("hmacFn must be a function");
	let v = u8n2(hashLen);
	let k = u8n2(hashLen);
	let i2 = 0;
	const reset = () => {
		v.fill(1);
		k.fill(0);
		i2 = 0;
	};
	const h = (...b) => hmacFn(k, v, ...b);
	const reseed = (seed = u8n2(0)) => {
		k = h(u8fr2([0]), seed);
		v = h();
		if (seed.length === 0) return;
		k = h(u8fr2([1]), seed);
		v = h();
	};
	const gen = () => {
		if (i2++ >= 1000) throw new Error("drbg: tried 1000 values");
		let len = 0;
		const out = [];
		while (len < qByteLen) {
			v = h();
			const sl = v.slice();
			out.push(sl);
			len += v.length;
		}
		return concatBytes5(...out);
	};
	const genUntil = (seed, pred) => {
		reset();
		reseed(seed);
		let res = undefined;
		while (!(res = pred(gen()))) reseed();
		reset();
		return res;
	};
	return genUntil;
}
var validatorFns2 = {
	bigint: (val) => typeof val === "bigint",
	function: (val) => typeof val === "function",
	boolean: (val) => typeof val === "boolean",
	string: (val) => typeof val === "string",
	stringOrUint8Array: (val) => typeof val === "string" || isBytes3(val),
	isSafeInteger: (val) => Number.isSafeInteger(val),
	array: (val) => Array.isArray(val),
	field: (val, object) => object.Fp.isValid(val),
	hash: (val) =>
		typeof val === "function" && Number.isSafeInteger(val.outputLen),
};
function validateObject2(object, validators, optValidators = {}) {
	const checkField = (fieldName, type, isOptional) => {
		const checkVal = validatorFns2[type];
		if (typeof checkVal !== "function")
			throw new Error("invalid validator function");
		const val = object[fieldName];
		if (isOptional && val === undefined) return;
		if (!checkVal(val, object)) {
			throw new Error(
				"param " +
					String(fieldName) +
					" is invalid. Expected " +
					type +
					", got " +
					val,
			);
		}
	};
	for (const [fieldName, type] of Object.entries(validators))
		checkField(fieldName, type, false);
	for (const [fieldName, type] of Object.entries(optValidators))
		checkField(fieldName, type, true);
	return object;
}
function memoized(fn) {
	const map = new WeakMap();
	return (arg, ...args) => {
		const val = map.get(arg);
		if (val !== undefined) return val;
		const computed = fn(arg, ...args);
		map.set(arg, computed);
		return computed;
	};
}

// node_modules/@noble/curves/esm/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n7 = BigInt(0);
var _1n7 = BigInt(1);
var _2n5 = /* @__PURE__ */ BigInt(2);
var _3n3 = /* @__PURE__ */ BigInt(3);
var _4n3 = /* @__PURE__ */ BigInt(4);
var _5n2 = /* @__PURE__ */ BigInt(5);
var _8n2 = /* @__PURE__ */ BigInt(8);
var _9n2 = /* @__PURE__ */ BigInt(9);
var _16n2 = /* @__PURE__ */ BigInt(16);
function mod2(a, b) {
	const result = a % b;
	return result >= _0n7 ? result : b + result;
}
function pow22(x, power, modulo) {
	let res = x;
	while (power-- > _0n7) {
		res *= res;
		res %= modulo;
	}
	return res;
}
function invert2(number4, modulo) {
	if (number4 === _0n7) throw new Error("invert: expected non-zero number");
	if (modulo <= _0n7)
		throw new Error("invert: expected positive modulus, got " + modulo);
	let a = mod2(number4, modulo);
	let b = modulo;
	let x = _0n7,
		y = _1n7,
		u = _1n7,
		v = _0n7;
	while (a !== _0n7) {
		const q = b / a;
		const r = b % a;
		const m = x - u * q;
		const n = y - v * q;
		(b = a), (a = r), (x = u), (y = v), (u = m), (v = n);
	}
	const gcd2 = b;
	if (gcd2 !== _1n7) throw new Error("invert: does not exist");
	return mod2(x, modulo);
}
function tonelliShanks2(P) {
	let Q = P - _1n7;
	let S = 0;
	while (Q % _2n5 === _0n7) {
		Q /= _2n5;
		S++;
	}
	let Z = _2n5;
	const _Fp = Field2(P);
	while (Z < P && FpIsSquare(_Fp, Z)) {
		if (Z++ > 1000)
			throw new Error("Cannot find square root: probably non-prime P");
	}
	if (S === 1) {
		const p1div4 = (P + _1n7) / _4n3;
		return function tonelliFast(Fp2, n) {
			const root = Fp2.pow(n, p1div4);
			if (!Fp2.eql(Fp2.sqr(root), n))
				throw new Error("Cannot find square root");
			return root;
		};
	}
	const Q1div2 = (Q + _1n7) / _2n5;
	return function tonelliSlow(Fp2, n) {
		if (!FpIsSquare(Fp2, n)) throw new Error("Cannot find square root");
		let r = S;
		let g = Fp2.pow(Fp2.mul(Fp2.ONE, Z), Q);
		let x = Fp2.pow(n, Q1div2);
		let b = Fp2.pow(n, Q);
		while (!Fp2.eql(b, Fp2.ONE)) {
			if (Fp2.eql(b, Fp2.ZERO)) return Fp2.ZERO;
			let m = 1;
			for (let t2 = Fp2.sqr(b); m < r; m++) {
				if (Fp2.eql(t2, Fp2.ONE)) break;
				t2 = Fp2.sqr(t2);
			}
			const ge2 = Fp2.pow(g, _1n7 << BigInt(r - m - 1));
			g = Fp2.sqr(ge2);
			x = Fp2.mul(x, ge2);
			b = Fp2.mul(b, g);
			r = m;
		}
		return x;
	};
}
function FpSqrt2(P) {
	if (P % _4n3 === _3n3) {
		return function sqrt3mod4(Fp2, n) {
			const p1div4 = (P + _1n7) / _4n3;
			const root = Fp2.pow(n, p1div4);
			if (!Fp2.eql(Fp2.sqr(root), n))
				throw new Error("Cannot find square root");
			return root;
		};
	}
	if (P % _8n2 === _5n2) {
		return function sqrt5mod8(Fp2, n) {
			const n2 = Fp2.mul(n, _2n5);
			const c1 = (P - _5n2) / _8n2;
			const v = Fp2.pow(n2, c1);
			const nv = Fp2.mul(n, v);
			const i2 = Fp2.mul(Fp2.mul(nv, _2n5), v);
			const root = Fp2.mul(nv, Fp2.sub(i2, Fp2.ONE));
			if (!Fp2.eql(Fp2.sqr(root), n))
				throw new Error("Cannot find square root");
			return root;
		};
	}
	if (P % _16n2 === _9n2) {
	}
	return tonelliShanks2(P);
}
var FIELD_FIELDS2 = [
	"create",
	"isValid",
	"is0",
	"neg",
	"inv",
	"sqrt",
	"sqr",
	"eql",
	"add",
	"sub",
	"mul",
	"pow",
	"div",
	"addN",
	"subN",
	"mulN",
	"sqrN",
];
function validateField2(field) {
	const initial = {
		ORDER: "bigint",
		MASK: "bigint",
		BYTES: "isSafeInteger",
		BITS: "isSafeInteger",
	};
	const opts = FIELD_FIELDS2.reduce((map, val) => {
		map[val] = "function";
		return map;
	}, initial);
	return validateObject2(field, opts);
}
function FpPow2(Fp2, num, power) {
	if (power < _0n7) throw new Error("invalid exponent, negatives unsupported");
	if (power === _0n7) return Fp2.ONE;
	if (power === _1n7) return num;
	let p = Fp2.ONE;
	let d = num;
	while (power > _0n7) {
		if (power & _1n7) p = Fp2.mul(p, d);
		d = Fp2.sqr(d);
		power >>= _1n7;
	}
	return p;
}
function FpInvertBatch2(Fp2, nums, passZero = false) {
	const inverted = new Array(nums.length).fill(passZero ? Fp2.ZERO : undefined);
	const multipliedAcc = nums.reduce((acc, num, i2) => {
		if (Fp2.is0(num)) return acc;
		inverted[i2] = acc;
		return Fp2.mul(acc, num);
	}, Fp2.ONE);
	const invertedAcc = Fp2.inv(multipliedAcc);
	nums.reduceRight((acc, num, i2) => {
		if (Fp2.is0(num)) return acc;
		inverted[i2] = Fp2.mul(acc, inverted[i2]);
		return Fp2.mul(acc, num);
	}, invertedAcc);
	return inverted;
}
function FpLegendre(Fp2, n) {
	const legc = (Fp2.ORDER - _1n7) / _2n5;
	const powered = Fp2.pow(n, legc);
	const yes = Fp2.eql(powered, Fp2.ONE);
	const zero = Fp2.eql(powered, Fp2.ZERO);
	const no = Fp2.eql(powered, Fp2.neg(Fp2.ONE));
	if (!yes && !zero && !no)
		throw new Error("Cannot find square root: probably non-prime P");
	return yes ? 1 : zero ? 0 : -1;
}
function FpIsSquare(Fp2, n) {
	const l = FpLegendre(Fp2, n);
	return l === 0 || l === 1;
}
function nLength2(n, nBitLength) {
	if (nBitLength !== undefined) anumber(nBitLength);
	const _nBitLength =
		nBitLength !== undefined ? nBitLength : n.toString(2).length;
	const nByteLength = Math.ceil(_nBitLength / 8);
	return { nBitLength: _nBitLength, nByteLength };
}
function Field2(ORDER, bitLen3, isLE4 = false, redef = {}) {
	if (ORDER <= _0n7)
		throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
	const { nBitLength: BITS, nByteLength: BYTES } = nLength2(ORDER, bitLen3);
	if (BYTES > 2048)
		throw new Error("invalid field: expected ORDER of <= 2048 bytes");
	let sqrtP;
	const f = Object.freeze({
		ORDER,
		isLE: isLE4,
		BITS,
		BYTES,
		MASK: bitMask2(BITS),
		ZERO: _0n7,
		ONE: _1n7,
		create: (num) => mod2(num, ORDER),
		isValid: (num) => {
			if (typeof num !== "bigint")
				throw new Error(
					"invalid field element: expected bigint, got " + typeof num,
				);
			return _0n7 <= num && num < ORDER;
		},
		is0: (num) => num === _0n7,
		isOdd: (num) => (num & _1n7) === _1n7,
		neg: (num) => mod2(-num, ORDER),
		eql: (lhs, rhs) => lhs === rhs,
		sqr: (num) => mod2(num * num, ORDER),
		add: (lhs, rhs) => mod2(lhs + rhs, ORDER),
		sub: (lhs, rhs) => mod2(lhs - rhs, ORDER),
		mul: (lhs, rhs) => mod2(lhs * rhs, ORDER),
		pow: (num, power) => FpPow2(f, num, power),
		div: (lhs, rhs) => mod2(lhs * invert2(rhs, ORDER), ORDER),
		sqrN: (num) => num * num,
		addN: (lhs, rhs) => lhs + rhs,
		subN: (lhs, rhs) => lhs - rhs,
		mulN: (lhs, rhs) => lhs * rhs,
		inv: (num) => invert2(num, ORDER),
		sqrt:
			redef.sqrt ||
			((n) => {
				if (!sqrtP) sqrtP = FpSqrt2(ORDER);
				return sqrtP(f, n);
			}),
		toBytes: (num) =>
			isLE4 ? numberToBytesLE2(num, BYTES) : numberToBytesBE2(num, BYTES),
		fromBytes: (bytes4) => {
			if (bytes4.length !== BYTES)
				throw new Error(
					"Field.fromBytes: expected " + BYTES + " bytes, got " + bytes4.length,
				);
			return isLE4 ? bytesToNumberLE2(bytes4) : bytesToNumberBE2(bytes4);
		},
		invertBatch: (lst) => FpInvertBatch2(f, lst),
		cmov: (a, b, c) => (c ? b : a),
	});
	return Object.freeze(f);
}
function getFieldBytesLength2(fieldOrder) {
	if (typeof fieldOrder !== "bigint")
		throw new Error("field order must be bigint");
	const bitLength = fieldOrder.toString(2).length;
	return Math.ceil(bitLength / 8);
}
function getMinHashLength2(fieldOrder) {
	const length = getFieldBytesLength2(fieldOrder);
	return length + Math.ceil(length / 2);
}
function mapHashToField2(key, fieldOrder, isLE4 = false) {
	const len = key.length;
	const fieldLen = getFieldBytesLength2(fieldOrder);
	const minLen = getMinHashLength2(fieldOrder);
	if (len < 16 || len < minLen || len > 1024)
		throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
	const num = isLE4 ? bytesToNumberLE2(key) : bytesToNumberBE2(key);
	const reduced = mod2(num, fieldOrder - _1n7) + _1n7;
	return isLE4
		? numberToBytesLE2(reduced, fieldLen)
		: numberToBytesBE2(reduced, fieldLen);
}

// node_modules/@noble/curves/esm/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n8 = BigInt(0);
var _1n8 = BigInt(1);
function constTimeNegate(condition, item) {
	const neg = item.negate();
	return condition ? neg : item;
}
function validateW(W, bits) {
	if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
		throw new Error(
			"invalid window size, expected [1.." + bits + "], got W=" + W,
		);
}
function calcWOpts(W, scalarBits) {
	validateW(W, scalarBits);
	const windows = Math.ceil(scalarBits / W) + 1;
	const windowSize = 2 ** (W - 1);
	const maxNumber = 2 ** W;
	const mask = bitMask2(W);
	const shiftBy = BigInt(W);
	return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window2, wOpts) {
	const { windowSize, mask, maxNumber, shiftBy } = wOpts;
	let wbits = Number(n & mask);
	let nextN = n >> shiftBy;
	if (wbits > windowSize) {
		wbits -= maxNumber;
		nextN += _1n8;
	}
	const offsetStart = window2 * windowSize;
	const offset = offsetStart + Math.abs(wbits) - 1;
	const isZero = wbits === 0;
	const isNeg = wbits < 0;
	const isNegF = window2 % 2 !== 0;
	const offsetF = offsetStart;
	return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
	if (!Array.isArray(points)) throw new Error("array expected");
	points.forEach((p, i2) => {
		if (!(p instanceof c)) throw new Error("invalid point at index " + i2);
	});
}
function validateMSMScalars(scalars, field) {
	if (!Array.isArray(scalars)) throw new Error("array of scalars expected");
	scalars.forEach((s, i2) => {
		if (!field.isValid(s)) throw new Error("invalid scalar at index " + i2);
	});
}
var pointPrecomputes = new WeakMap();
var pointWindowSizes = new WeakMap();
function getW(P) {
	return pointWindowSizes.get(P) || 1;
}
function wNAF2(c, bits) {
	return {
		constTimeNegate,
		hasPrecomputes(elm) {
			return getW(elm) !== 1;
		},
		unsafeLadder(elm, n, p = c.ZERO) {
			let d = elm;
			while (n > _0n8) {
				if (n & _1n8) p = p.add(d);
				d = d.double();
				n >>= _1n8;
			}
			return p;
		},
		precomputeWindow(elm, W) {
			const { windows, windowSize } = calcWOpts(W, bits);
			const points = [];
			let p = elm;
			let base = p;
			for (let window2 = 0; window2 < windows; window2++) {
				base = p;
				points.push(base);
				for (let i2 = 1; i2 < windowSize; i2++) {
					base = base.add(p);
					points.push(base);
				}
				p = base.double();
			}
			return points;
		},
		wNAF(W, precomputes, n) {
			let p = c.ZERO;
			let f = c.BASE;
			const wo = calcWOpts(W, bits);
			for (let window2 = 0; window2 < wo.windows; window2++) {
				const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(
					n,
					window2,
					wo,
				);
				n = nextN;
				if (isZero) {
					f = f.add(constTimeNegate(isNegF, precomputes[offsetF]));
				} else {
					p = p.add(constTimeNegate(isNeg, precomputes[offset]));
				}
			}
			return { p, f };
		},
		wNAFUnsafe(W, precomputes, n, acc = c.ZERO) {
			const wo = calcWOpts(W, bits);
			for (let window2 = 0; window2 < wo.windows; window2++) {
				if (n === _0n8) break;
				const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
				n = nextN;
				if (isZero) {
					continue;
				} else {
					const item = precomputes[offset];
					acc = acc.add(isNeg ? item.negate() : item);
				}
			}
			return acc;
		},
		getPrecomputes(W, P, transform) {
			let comp = pointPrecomputes.get(P);
			if (!comp) {
				comp = this.precomputeWindow(P, W);
				if (W !== 1) pointPrecomputes.set(P, transform(comp));
			}
			return comp;
		},
		wNAFCached(P, n, transform) {
			const W = getW(P);
			return this.wNAF(W, this.getPrecomputes(W, P, transform), n);
		},
		wNAFCachedUnsafe(P, n, transform, prev) {
			const W = getW(P);
			if (W === 1) return this.unsafeLadder(P, n, prev);
			return this.wNAFUnsafe(W, this.getPrecomputes(W, P, transform), n, prev);
		},
		setWindowSize(P, W) {
			validateW(W, bits);
			pointWindowSizes.set(P, W);
			pointPrecomputes.delete(P);
		},
	};
}
function pippenger(c, fieldN, points, scalars) {
	validateMSMPoints(points, c);
	validateMSMScalars(scalars, fieldN);
	if (points.length !== scalars.length)
		throw new Error("arrays of points and scalars must have equal length");
	const zero = c.ZERO;
	const wbits = bitLen2(BigInt(points.length));
	const windowSize =
		wbits > 12 ? wbits - 3 : wbits > 4 ? wbits - 2 : wbits ? 2 : 1;
	const MASK = bitMask2(windowSize);
	const buckets = new Array(Number(MASK) + 1).fill(zero);
	const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
	let sum = zero;
	for (let i2 = lastBits; i2 >= 0; i2 -= windowSize) {
		buckets.fill(zero);
		for (let j = 0; j < scalars.length; j++) {
			const scalar = scalars[j];
			const wbits2 = Number((scalar >> BigInt(i2)) & MASK);
			buckets[wbits2] = buckets[wbits2].add(points[j]);
		}
		let resI = zero;
		for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
			sumI = sumI.add(buckets[j]);
			resI = resI.add(sumI);
		}
		sum = sum.add(resI);
		if (i2 !== 0) for (let j = 0; j < windowSize; j++) sum = sum.double();
	}
	return sum;
}
function validateBasic2(curve) {
	validateField2(curve.Fp);
	validateObject2(
		curve,
		{
			n: "bigint",
			h: "bigint",
			Gx: "field",
			Gy: "field",
		},
		{
			nBitLength: "isSafeInteger",
			nByteLength: "isSafeInteger",
		},
	);
	return Object.freeze({
		...nLength2(curve.n, curve.nBitLength),
		...curve,
		...{ p: curve.Fp.ORDER },
	});
}

// node_modules/@noble/curves/esm/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function validateSigVerOpts(opts) {
	if (opts.lowS !== undefined) abool("lowS", opts.lowS);
	if (opts.prehash !== undefined) abool("prehash", opts.prehash);
}
function validatePointOpts2(curve) {
	const opts = validateBasic2(curve);
	validateObject2(
		opts,
		{
			a: "field",
			b: "field",
		},
		{
			allowedPrivateKeyLengths: "array",
			wrapPrivateKey: "boolean",
			isTorsionFree: "function",
			clearCofactor: "function",
			allowInfinityPoint: "boolean",
			fromBytes: "function",
			toBytes: "function",
		},
	);
	const { endo, Fp: Fp2, a } = opts;
	if (endo) {
		if (!Fp2.eql(a, Fp2.ZERO)) {
			throw new Error(
				"invalid endomorphism, can only be defined for Koblitz curves that have a=0",
			);
		}
		if (
			typeof endo !== "object" ||
			typeof endo.beta !== "bigint" ||
			typeof endo.splitScalar !== "function"
		) {
			throw new Error(
				"invalid endomorphism, expected beta: bigint and splitScalar: function",
			);
		}
	}
	return Object.freeze({ ...opts });
}

class DERErr2 extends Error {
	constructor(m = "") {
		super(m);
	}
}
var DER2 = {
	Err: DERErr2,
	_tlv: {
		encode: (tag, data) => {
			const { Err: E } = DER2;
			if (tag < 0 || tag > 256) throw new E("tlv.encode: wrong tag");
			if (data.length & 1) throw new E("tlv.encode: unpadded data");
			const dataLen = data.length / 2;
			const len = numberToHexUnpadded2(dataLen);
			if ((len.length / 2) & 128)
				throw new E("tlv.encode: long form length too big");
			const lenLen =
				dataLen > 127 ? numberToHexUnpadded2((len.length / 2) | 128) : "";
			const t = numberToHexUnpadded2(tag);
			return t + lenLen + len + data;
		},
		decode(tag, data) {
			const { Err: E } = DER2;
			let pos = 0;
			if (tag < 0 || tag > 256) throw new E("tlv.encode: wrong tag");
			if (data.length < 2 || data[pos++] !== tag)
				throw new E("tlv.decode: wrong tlv");
			const first = data[pos++];
			const isLong = !!(first & 128);
			let length = 0;
			if (!isLong) length = first;
			else {
				const lenLen = first & 127;
				if (!lenLen)
					throw new E("tlv.decode(long): indefinite length not supported");
				if (lenLen > 4) throw new E("tlv.decode(long): byte length is too big");
				const lengthBytes = data.subarray(pos, pos + lenLen);
				if (lengthBytes.length !== lenLen)
					throw new E("tlv.decode: length bytes not complete");
				if (lengthBytes[0] === 0)
					throw new E("tlv.decode(long): zero leftmost byte");
				for (const b of lengthBytes) length = (length << 8) | b;
				pos += lenLen;
				if (length < 128) throw new E("tlv.decode(long): not minimal encoding");
			}
			const v = data.subarray(pos, pos + length);
			if (v.length !== length) throw new E("tlv.decode: wrong value length");
			return { v, l: data.subarray(pos + length) };
		},
	},
	_int: {
		encode(num) {
			const { Err: E } = DER2;
			if (num < _0n9) throw new E("integer: negative integers are not allowed");
			let hex2 = numberToHexUnpadded2(num);
			if (Number.parseInt(hex2[0], 16) & 8) hex2 = "00" + hex2;
			if (hex2.length & 1)
				throw new E("unexpected DER parsing assertion: unpadded hex");
			return hex2;
		},
		decode(data) {
			const { Err: E } = DER2;
			if (data[0] & 128) throw new E("invalid signature integer: negative");
			if (data[0] === 0 && !(data[1] & 128))
				throw new E("invalid signature integer: unnecessary leading zero");
			return bytesToNumberBE2(data);
		},
	},
	toSig(hex2) {
		const { Err: E, _int: int, _tlv: tlv } = DER2;
		const data = ensureBytes2("signature", hex2);
		const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
		if (seqLeftBytes.length)
			throw new E("invalid signature: left bytes after parsing");
		const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
		const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
		if (sLeftBytes.length)
			throw new E("invalid signature: left bytes after parsing");
		return { r: int.decode(rBytes), s: int.decode(sBytes) };
	},
	hexFromSig(sig) {
		const { _tlv: tlv, _int: int } = DER2;
		const rs = tlv.encode(2, int.encode(sig.r));
		const ss = tlv.encode(2, int.encode(sig.s));
		const seq = rs + ss;
		return tlv.encode(48, seq);
	},
};
var _0n9 = BigInt(0);
var _1n9 = BigInt(1);
var _2n6 = BigInt(2);
var _3n4 = BigInt(3);
var _4n4 = BigInt(4);
function weierstrassPoints2(opts) {
	const CURVE = validatePointOpts2(opts);
	const { Fp: Fp2 } = CURVE;
	const Fn = Field2(CURVE.n, CURVE.nBitLength);
	const toBytes5 =
		CURVE.toBytes ||
		((_c, point, _isCompressed) => {
			const a = point.toAffine();
			return concatBytes5(
				Uint8Array.from([4]),
				Fp2.toBytes(a.x),
				Fp2.toBytes(a.y),
			);
		});
	const fromBytes =
		CURVE.fromBytes ||
		((bytes4) => {
			const tail = bytes4.subarray(1);
			const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
			const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
			return { x, y };
		});
	function weierstrassEquation(x) {
		const { a, b } = CURVE;
		const x2 = Fp2.sqr(x);
		const x3 = Fp2.mul(x2, x);
		return Fp2.add(Fp2.add(x3, Fp2.mul(x, a)), b);
	}
	if (!Fp2.eql(Fp2.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
		throw new Error("bad generator point: equation left != right");
	function isWithinCurveOrder(num) {
		return inRange(num, _1n9, CURVE.n);
	}
	function normPrivateKeyToScalar(key) {
		const {
			allowedPrivateKeyLengths: lengths,
			nByteLength,
			wrapPrivateKey,
			n: N,
		} = CURVE;
		if (lengths && typeof key !== "bigint") {
			if (isBytes3(key)) key = bytesToHex4(key);
			if (typeof key !== "string" || !lengths.includes(key.length))
				throw new Error("invalid private key");
			key = key.padStart(nByteLength * 2, "0");
		}
		let num;
		try {
			num =
				typeof key === "bigint"
					? key
					: bytesToNumberBE2(ensureBytes2("private key", key, nByteLength));
		} catch (error) {
			throw new Error(
				"invalid private key, expected hex or " +
					nByteLength +
					" bytes, got " +
					typeof key,
			);
		}
		if (wrapPrivateKey) num = mod2(num, N);
		aInRange("private key", num, _1n9, N);
		return num;
	}
	function aprjpoint(other) {
		if (!(other instanceof Point2)) throw new Error("ProjectivePoint expected");
	}
	const toAffineMemo = memoized((p, iz) => {
		const { px: x, py: y, pz: z } = p;
		if (Fp2.eql(z, Fp2.ONE)) return { x, y };
		const is0 = p.is0();
		if (iz == null) iz = is0 ? Fp2.ONE : Fp2.inv(z);
		const ax = Fp2.mul(x, iz);
		const ay = Fp2.mul(y, iz);
		const zz = Fp2.mul(z, iz);
		if (is0) return { x: Fp2.ZERO, y: Fp2.ZERO };
		if (!Fp2.eql(zz, Fp2.ONE)) throw new Error("invZ was invalid");
		return { x: ax, y: ay };
	});
	const assertValidMemo = memoized((p) => {
		if (p.is0()) {
			if (CURVE.allowInfinityPoint && !Fp2.is0(p.py)) return;
			throw new Error("bad point: ZERO");
		}
		const { x, y } = p.toAffine();
		if (!Fp2.isValid(x) || !Fp2.isValid(y))
			throw new Error("bad point: x or y not FE");
		const left = Fp2.sqr(y);
		const right = weierstrassEquation(x);
		if (!Fp2.eql(left, right))
			throw new Error("bad point: equation left != right");
		if (!p.isTorsionFree())
			throw new Error("bad point: not in prime-order subgroup");
		return true;
	});

	class Point2 {
		constructor(px, py, pz) {
			if (px == null || !Fp2.isValid(px)) throw new Error("x required");
			if (py == null || !Fp2.isValid(py) || Fp2.is0(py))
				throw new Error("y required");
			if (pz == null || !Fp2.isValid(pz)) throw new Error("z required");
			this.px = px;
			this.py = py;
			this.pz = pz;
			Object.freeze(this);
		}
		static fromAffine(p) {
			const { x, y } = p || {};
			if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
				throw new Error("invalid affine point");
			if (p instanceof Point2) throw new Error("projective point not allowed");
			const is0 = (i2) => Fp2.eql(i2, Fp2.ZERO);
			if (is0(x) && is0(y)) return Point2.ZERO;
			return new Point2(x, y, Fp2.ONE);
		}
		get x() {
			return this.toAffine().x;
		}
		get y() {
			return this.toAffine().y;
		}
		static normalizeZ(points) {
			const toInv = FpInvertBatch2(
				Fp2,
				points.map((p) => p.pz),
			);
			return points
				.map((p, i2) => p.toAffine(toInv[i2]))
				.map(Point2.fromAffine);
		}
		static fromHex(hex2) {
			const P = Point2.fromAffine(fromBytes(ensureBytes2("pointHex", hex2)));
			P.assertValidity();
			return P;
		}
		static fromPrivateKey(privateKey) {
			return Point2.BASE.multiply(normPrivateKeyToScalar(privateKey));
		}
		static msm(points, scalars) {
			return pippenger(Point2, Fn, points, scalars);
		}
		_setWindowSize(windowSize) {
			wnaf.setWindowSize(this, windowSize);
		}
		assertValidity() {
			assertValidMemo(this);
		}
		hasEvenY() {
			const { y } = this.toAffine();
			if (Fp2.isOdd) return !Fp2.isOdd(y);
			throw new Error("Field doesn't support isOdd");
		}
		equals(other) {
			aprjpoint(other);
			const { px: X1, py: Y1, pz: Z1 } = this;
			const { px: X2, py: Y2, pz: Z2 } = other;
			const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
			const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
			return U1 && U2;
		}
		negate() {
			return new Point2(this.px, Fp2.neg(this.py), this.pz);
		}
		double() {
			const { a, b } = CURVE;
			const b3 = Fp2.mul(b, _3n4);
			const { px: X1, py: Y1, pz: Z1 } = this;
			let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp2;
			let t0 = Fp2.mul(X1, X1);
			const t1 = Fp2.mul(Y1, Y1);
			let t2 = Fp2.mul(Z1, Z1);
			let t3 = Fp2.mul(X1, Y1);
			t3 = Fp2.add(t3, t3);
			Z3 = Fp2.mul(X1, Z1);
			Z3 = Fp2.add(Z3, Z3);
			X3 = Fp2.mul(a, Z3);
			Y3 = Fp2.mul(b3, t2);
			Y3 = Fp2.add(X3, Y3);
			X3 = Fp2.sub(t1, Y3);
			Y3 = Fp2.add(t1, Y3);
			Y3 = Fp2.mul(X3, Y3);
			X3 = Fp2.mul(t3, X3);
			Z3 = Fp2.mul(b3, Z3);
			t2 = Fp2.mul(a, t2);
			t3 = Fp2.sub(t0, t2);
			t3 = Fp2.mul(a, t3);
			t3 = Fp2.add(t3, Z3);
			Z3 = Fp2.add(t0, t0);
			t0 = Fp2.add(Z3, t0);
			t0 = Fp2.add(t0, t2);
			t0 = Fp2.mul(t0, t3);
			Y3 = Fp2.add(Y3, t0);
			t2 = Fp2.mul(Y1, Z1);
			t2 = Fp2.add(t2, t2);
			t0 = Fp2.mul(t2, t3);
			X3 = Fp2.sub(X3, t0);
			Z3 = Fp2.mul(t2, t1);
			Z3 = Fp2.add(Z3, Z3);
			Z3 = Fp2.add(Z3, Z3);
			return new Point2(X3, Y3, Z3);
		}
		add(other) {
			aprjpoint(other);
			const { px: X1, py: Y1, pz: Z1 } = this;
			const { px: X2, py: Y2, pz: Z2 } = other;
			let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp2;
			const a = CURVE.a;
			const b3 = Fp2.mul(CURVE.b, _3n4);
			let t0 = Fp2.mul(X1, X2);
			let t1 = Fp2.mul(Y1, Y2);
			let t2 = Fp2.mul(Z1, Z2);
			let t3 = Fp2.add(X1, Y1);
			let t4 = Fp2.add(X2, Y2);
			t3 = Fp2.mul(t3, t4);
			t4 = Fp2.add(t0, t1);
			t3 = Fp2.sub(t3, t4);
			t4 = Fp2.add(X1, Z1);
			let t5 = Fp2.add(X2, Z2);
			t4 = Fp2.mul(t4, t5);
			t5 = Fp2.add(t0, t2);
			t4 = Fp2.sub(t4, t5);
			t5 = Fp2.add(Y1, Z1);
			X3 = Fp2.add(Y2, Z2);
			t5 = Fp2.mul(t5, X3);
			X3 = Fp2.add(t1, t2);
			t5 = Fp2.sub(t5, X3);
			Z3 = Fp2.mul(a, t4);
			X3 = Fp2.mul(b3, t2);
			Z3 = Fp2.add(X3, Z3);
			X3 = Fp2.sub(t1, Z3);
			Z3 = Fp2.add(t1, Z3);
			Y3 = Fp2.mul(X3, Z3);
			t1 = Fp2.add(t0, t0);
			t1 = Fp2.add(t1, t0);
			t2 = Fp2.mul(a, t2);
			t4 = Fp2.mul(b3, t4);
			t1 = Fp2.add(t1, t2);
			t2 = Fp2.sub(t0, t2);
			t2 = Fp2.mul(a, t2);
			t4 = Fp2.add(t4, t2);
			t0 = Fp2.mul(t1, t4);
			Y3 = Fp2.add(Y3, t0);
			t0 = Fp2.mul(t5, t4);
			X3 = Fp2.mul(t3, X3);
			X3 = Fp2.sub(X3, t0);
			t0 = Fp2.mul(t3, t1);
			Z3 = Fp2.mul(t5, Z3);
			Z3 = Fp2.add(Z3, t0);
			return new Point2(X3, Y3, Z3);
		}
		subtract(other) {
			return this.add(other.negate());
		}
		is0() {
			return this.equals(Point2.ZERO);
		}
		wNAF(n) {
			return wnaf.wNAFCached(this, n, Point2.normalizeZ);
		}
		multiplyUnsafe(sc) {
			const { endo, n: N } = CURVE;
			aInRange("scalar", sc, _0n9, N);
			const I = Point2.ZERO;
			if (sc === _0n9) return I;
			if (this.is0() || sc === _1n9) return this;
			if (!endo || wnaf.hasPrecomputes(this))
				return wnaf.wNAFCachedUnsafe(this, sc, Point2.normalizeZ);
			let { k1neg, k1, k2neg, k2 } = endo.splitScalar(sc);
			let k1p = I;
			let k2p = I;
			let d = this;
			while (k1 > _0n9 || k2 > _0n9) {
				if (k1 & _1n9) k1p = k1p.add(d);
				if (k2 & _1n9) k2p = k2p.add(d);
				d = d.double();
				k1 >>= _1n9;
				k2 >>= _1n9;
			}
			if (k1neg) k1p = k1p.negate();
			if (k2neg) k2p = k2p.negate();
			k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
			return k1p.add(k2p);
		}
		multiply(scalar) {
			const { endo, n: N } = CURVE;
			aInRange("scalar", scalar, _1n9, N);
			let point, fake;
			if (endo) {
				const { k1neg, k1, k2neg, k2 } = endo.splitScalar(scalar);
				let { p: k1p, f: f1p } = this.wNAF(k1);
				let { p: k2p, f: f2p } = this.wNAF(k2);
				k1p = wnaf.constTimeNegate(k1neg, k1p);
				k2p = wnaf.constTimeNegate(k2neg, k2p);
				k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
				point = k1p.add(k2p);
				fake = f1p.add(f2p);
			} else {
				const { p, f } = this.wNAF(scalar);
				point = p;
				fake = f;
			}
			return Point2.normalizeZ([point, fake])[0];
		}
		multiplyAndAddUnsafe(Q, a, b) {
			const G = Point2.BASE;
			const mul3 = (P, a2) =>
				a2 === _0n9 || a2 === _1n9 || !P.equals(G)
					? P.multiplyUnsafe(a2)
					: P.multiply(a2);
			const sum = mul3(this, a).add(mul3(Q, b));
			return sum.is0() ? undefined : sum;
		}
		toAffine(iz) {
			return toAffineMemo(this, iz);
		}
		isTorsionFree() {
			const { h: cofactor, isTorsionFree } = CURVE;
			if (cofactor === _1n9) return true;
			if (isTorsionFree) return isTorsionFree(Point2, this);
			throw new Error(
				"isTorsionFree() has not been declared for the elliptic curve",
			);
		}
		clearCofactor() {
			const { h: cofactor, clearCofactor } = CURVE;
			if (cofactor === _1n9) return this;
			if (clearCofactor) return clearCofactor(Point2, this);
			return this.multiplyUnsafe(CURVE.h);
		}
		toRawBytes(isCompressed = true) {
			abool("isCompressed", isCompressed);
			this.assertValidity();
			return toBytes5(Point2, this, isCompressed);
		}
		toHex(isCompressed = true) {
			abool("isCompressed", isCompressed);
			return bytesToHex4(this.toRawBytes(isCompressed));
		}
	}
	Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp2.ONE);
	Point2.ZERO = new Point2(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
	const _bits = CURVE.nBitLength;
	const wnaf = wNAF2(Point2, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
	return {
		CURVE,
		ProjectivePoint: Point2,
		normPrivateKeyToScalar,
		weierstrassEquation,
		isWithinCurveOrder,
	};
}
function validateOpts2(curve) {
	const opts = validateBasic2(curve);
	validateObject2(
		opts,
		{
			hash: "hash",
			hmac: "function",
			randomBytes: "function",
		},
		{
			bits2int: "function",
			bits2int_modN: "function",
			lowS: "boolean",
		},
	);
	return Object.freeze({ lowS: true, ...opts });
}
function weierstrass2(curveDef) {
	const CURVE = validateOpts2(curveDef);
	const { Fp: Fp2, n: CURVE_ORDER } = CURVE;
	const compressedLen = Fp2.BYTES + 1;
	const uncompressedLen = 2 * Fp2.BYTES + 1;
	function modN2(a) {
		return mod2(a, CURVE_ORDER);
	}
	function invN(a) {
		return invert2(a, CURVE_ORDER);
	}
	const {
		ProjectivePoint: Point2,
		normPrivateKeyToScalar,
		weierstrassEquation,
		isWithinCurveOrder,
	} = weierstrassPoints2({
		...CURVE,
		toBytes(_c, point, isCompressed) {
			const a = point.toAffine();
			const x = Fp2.toBytes(a.x);
			const cat = concatBytes5;
			abool("isCompressed", isCompressed);
			if (isCompressed) {
				return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
			} else {
				return cat(Uint8Array.from([4]), x, Fp2.toBytes(a.y));
			}
		},
		fromBytes(bytes4) {
			const len = bytes4.length;
			const head = bytes4[0];
			const tail = bytes4.subarray(1);
			if (len === compressedLen && (head === 2 || head === 3)) {
				const x = bytesToNumberBE2(tail);
				if (!inRange(x, _1n9, Fp2.ORDER))
					throw new Error("Point is not on curve");
				const y2 = weierstrassEquation(x);
				let y;
				try {
					y = Fp2.sqrt(y2);
				} catch (sqrtError) {
					const suffix =
						sqrtError instanceof Error ? ": " + sqrtError.message : "";
					throw new Error("Point is not on curve" + suffix);
				}
				const isYOdd = (y & _1n9) === _1n9;
				const isHeadOdd = (head & 1) === 1;
				if (isHeadOdd !== isYOdd) y = Fp2.neg(y);
				return { x, y };
			} else if (len === uncompressedLen && head === 4) {
				const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
				const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
				return { x, y };
			} else {
				const cl = compressedLen;
				const ul = uncompressedLen;
				throw new Error(
					"invalid Point, expected length of " +
						cl +
						", or uncompressed " +
						ul +
						", got " +
						len,
				);
			}
		},
	});
	const numToNByteHex = (num) =>
		bytesToHex4(numberToBytesBE2(num, CURVE.nByteLength));
	function isBiggerThanHalfOrder(number4) {
		const HALF = CURVE_ORDER >> _1n9;
		return number4 > HALF;
	}
	function normalizeS(s) {
		return isBiggerThanHalfOrder(s) ? modN2(-s) : s;
	}
	const slcNum = (b, from, to) => bytesToNumberBE2(b.slice(from, to));

	class Signature {
		constructor(r, s, recovery) {
			aInRange("r", r, _1n9, CURVE_ORDER);
			aInRange("s", s, _1n9, CURVE_ORDER);
			this.r = r;
			this.s = s;
			if (recovery != null) this.recovery = recovery;
			Object.freeze(this);
		}
		static fromCompact(hex2) {
			const l = CURVE.nByteLength;
			hex2 = ensureBytes2("compactSignature", hex2, l * 2);
			return new Signature(slcNum(hex2, 0, l), slcNum(hex2, l, 2 * l));
		}
		static fromDER(hex2) {
			const { r, s } = DER2.toSig(ensureBytes2("DER", hex2));
			return new Signature(r, s);
		}
		assertValidity() {}
		addRecoveryBit(recovery) {
			return new Signature(this.r, this.s, recovery);
		}
		recoverPublicKey(msgHash) {
			const { r, s, recovery: rec } = this;
			const h = bits2int_modN(ensureBytes2("msgHash", msgHash));
			if (rec == null || ![0, 1, 2, 3].includes(rec))
				throw new Error("recovery id invalid");
			const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
			if (radj >= Fp2.ORDER) throw new Error("recovery id 2 or 3 invalid");
			const prefix = (rec & 1) === 0 ? "02" : "03";
			const R = Point2.fromHex(prefix + numToNByteHex(radj));
			const ir = invN(radj);
			const u1 = modN2(-h * ir);
			const u2 = modN2(s * ir);
			const Q = Point2.BASE.multiplyAndAddUnsafe(R, u1, u2);
			if (!Q) throw new Error("point at infinify");
			Q.assertValidity();
			return Q;
		}
		hasHighS() {
			return isBiggerThanHalfOrder(this.s);
		}
		normalizeS() {
			return this.hasHighS()
				? new Signature(this.r, modN2(-this.s), this.recovery)
				: this;
		}
		toDERRawBytes() {
			return hexToBytes4(this.toDERHex());
		}
		toDERHex() {
			return DER2.hexFromSig(this);
		}
		toCompactRawBytes() {
			return hexToBytes4(this.toCompactHex());
		}
		toCompactHex() {
			return numToNByteHex(this.r) + numToNByteHex(this.s);
		}
	}
	const utils = {
		isValidPrivateKey(privateKey) {
			try {
				normPrivateKeyToScalar(privateKey);
				return true;
			} catch (error) {
				return false;
			}
		},
		normPrivateKeyToScalar,
		randomPrivateKey: () => {
			const length = getMinHashLength2(CURVE.n);
			return mapHashToField2(CURVE.randomBytes(length), CURVE.n);
		},
		precompute(windowSize = 8, point = Point2.BASE) {
			point._setWindowSize(windowSize);
			point.multiply(BigInt(3));
			return point;
		},
	};
	function getPublicKey2(privateKey, isCompressed = true) {
		return Point2.fromPrivateKey(privateKey).toRawBytes(isCompressed);
	}
	function isProbPub(item) {
		const arr = isBytes3(item);
		const str = typeof item === "string";
		const len = (arr || str) && item.length;
		if (arr) return len === compressedLen || len === uncompressedLen;
		if (str) return len === 2 * compressedLen || len === 2 * uncompressedLen;
		if (item instanceof Point2) return true;
		return false;
	}
	function getSharedSecret(privateA, publicB, isCompressed = true) {
		if (isProbPub(privateA)) throw new Error("first arg must be private key");
		if (!isProbPub(publicB)) throw new Error("second arg must be public key");
		const b = Point2.fromHex(publicB);
		return b
			.multiply(normPrivateKeyToScalar(privateA))
			.toRawBytes(isCompressed);
	}
	const bits2int =
		CURVE.bits2int ||
		((bytes4) => {
			if (bytes4.length > 8192) throw new Error("input is too large");
			const num = bytesToNumberBE2(bytes4);
			const delta = bytes4.length * 8 - CURVE.nBitLength;
			return delta > 0 ? num >> BigInt(delta) : num;
		});
	const bits2int_modN =
		CURVE.bits2int_modN || ((bytes4) => modN2(bits2int(bytes4)));
	const ORDER_MASK = bitMask2(CURVE.nBitLength);
	function int2octets(num) {
		aInRange("num < 2^" + CURVE.nBitLength, num, _0n9, ORDER_MASK);
		return numberToBytesBE2(num, CURVE.nByteLength);
	}
	function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
		if (["recovered", "canonical"].some((k) => k in opts))
			throw new Error("sign() legacy options not supported");
		const { hash: hash3, randomBytes: randomBytes4 } = CURVE;
		let { lowS, prehash, extraEntropy: ent } = opts;
		if (lowS == null) lowS = true;
		msgHash = ensureBytes2("msgHash", msgHash);
		validateSigVerOpts(opts);
		if (prehash) msgHash = ensureBytes2("prehashed msgHash", hash3(msgHash));
		const h1int = bits2int_modN(msgHash);
		const d = normPrivateKeyToScalar(privateKey);
		const seedArgs = [int2octets(d), int2octets(h1int)];
		if (ent != null && ent !== false) {
			const e = ent === true ? randomBytes4(Fp2.BYTES) : ent;
			seedArgs.push(ensureBytes2("extraEntropy", e));
		}
		const seed = concatBytes5(...seedArgs);
		const m = h1int;
		function k2sig(kBytes) {
			const k = bits2int(kBytes);
			if (!isWithinCurveOrder(k)) return;
			const ik = invN(k);
			const q = Point2.BASE.multiply(k).toAffine();
			const r = modN2(q.x);
			if (r === _0n9) return;
			const s = modN2(ik * modN2(m + r * d));
			if (s === _0n9) return;
			let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n9);
			let normS = s;
			if (lowS && isBiggerThanHalfOrder(s)) {
				normS = normalizeS(s);
				recovery ^= 1;
			}
			return new Signature(r, normS, recovery);
		}
		return { seed, k2sig };
	}
	const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
	const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
	function sign(msgHash, privKey, opts = defaultSigOpts) {
		const { seed, k2sig } = prepSig(msgHash, privKey, opts);
		const C = CURVE;
		const drbg = createHmacDrbg2(C.hash.outputLen, C.nByteLength, C.hmac);
		return drbg(seed, k2sig);
	}
	Point2.BASE._setWindowSize(8);
	function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
		const sg = signature;
		msgHash = ensureBytes2("msgHash", msgHash);
		publicKey = ensureBytes2("publicKey", publicKey);
		const { lowS, prehash, format } = opts;
		validateSigVerOpts(opts);
		if ("strict" in opts) throw new Error("options.strict was renamed to lowS");
		if (format !== undefined && format !== "compact" && format !== "der")
			throw new Error("format must be compact or der");
		const isHex = typeof sg === "string" || isBytes3(sg);
		const isObj =
			!isHex &&
			!format &&
			typeof sg === "object" &&
			sg !== null &&
			typeof sg.r === "bigint" &&
			typeof sg.s === "bigint";
		if (!isHex && !isObj)
			throw new Error(
				"invalid signature, expected Uint8Array, hex string or Signature instance",
			);
		let _sig = undefined;
		let P;
		try {
			if (isObj) _sig = new Signature(sg.r, sg.s);
			if (isHex) {
				try {
					if (format !== "compact") _sig = Signature.fromDER(sg);
				} catch (derError) {
					if (!(derError instanceof DER2.Err)) throw derError;
				}
				if (!_sig && format !== "der") _sig = Signature.fromCompact(sg);
			}
			P = Point2.fromHex(publicKey);
		} catch (error) {
			return false;
		}
		if (!_sig) return false;
		if (lowS && _sig.hasHighS()) return false;
		if (prehash) msgHash = CURVE.hash(msgHash);
		const { r, s } = _sig;
		const h = bits2int_modN(msgHash);
		const is = invN(s);
		const u1 = modN2(h * is);
		const u2 = modN2(r * is);
		const R = Point2.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine();
		if (!R) return false;
		const v = modN2(R.x);
		return v === r;
	}
	return {
		CURVE,
		getPublicKey: getPublicKey2,
		getSharedSecret,
		sign,
		verify,
		ProjectivePoint: Point2,
		Signature,
		utils,
	};
}

// node_modules/@noble/curves/esm/_shortw_utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function getHash2(hash3) {
	return {
		hash: hash3,
		hmac: (key, ...msgs) => hmac3(hash3, key, concatBytes4(...msgs)),
		randomBytes: randomBytes3,
	};
}
function createCurve2(curveDef, defHash) {
	const create = (hash3) => weierstrass2({ ...curveDef, ...getHash2(hash3) });
	return { ...create(defHash), create };
}

// node_modules/@noble/curves/esm/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1P2 = BigInt(
	"0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
);
var secp256k1N2 = BigInt(
	"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
var _1n10 = BigInt(1);
var _2n7 = BigInt(2);
var divNearest2 = (a, b) => (a + b / _2n7) / b;
function sqrtMod2(y) {
	const P = secp256k1P2;
	const _3n5 = BigInt(3),
		_6n = BigInt(6),
		_11n = BigInt(11),
		_22n = BigInt(22);
	const _23n = BigInt(23),
		_44n = BigInt(44),
		_88n = BigInt(88);
	const b2 = (y * y * y) % P;
	const b3 = (b2 * b2 * y) % P;
	const b6 = (pow22(b3, _3n5, P) * b3) % P;
	const b9 = (pow22(b6, _3n5, P) * b3) % P;
	const b11 = (pow22(b9, _2n7, P) * b2) % P;
	const b22 = (pow22(b11, _11n, P) * b11) % P;
	const b44 = (pow22(b22, _22n, P) * b22) % P;
	const b88 = (pow22(b44, _44n, P) * b44) % P;
	const b176 = (pow22(b88, _88n, P) * b88) % P;
	const b220 = (pow22(b176, _44n, P) * b44) % P;
	const b223 = (pow22(b220, _3n5, P) * b3) % P;
	const t1 = (pow22(b223, _23n, P) * b22) % P;
	const t2 = (pow22(t1, _6n, P) * b2) % P;
	const root = pow22(t2, _2n7, P);
	if (!Fpk1.eql(Fpk1.sqr(root), y)) throw new Error("Cannot find square root");
	return root;
}
var Fpk1 = Field2(secp256k1P2, undefined, undefined, { sqrt: sqrtMod2 });
var secp256k12 = createCurve2(
	{
		a: BigInt(0),
		b: BigInt(7),
		Fp: Fpk1,
		n: secp256k1N2,
		Gx: BigInt(
			"55066263022277343669578718895168534326250603453777594175500187360389116729240",
		),
		Gy: BigInt(
			"32670510020758816978083085130507043184471273380659243275938904335757337482424",
		),
		h: BigInt(1),
		lowS: true,
		endo: {
			beta: BigInt(
				"0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
			),
			splitScalar: (k) => {
				const n = secp256k1N2;
				const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
				const b1 = -_1n10 * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
				const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
				const b2 = a1;
				const POW_2_128 = BigInt("0x100000000000000000000000000000000");
				const c1 = divNearest2(b2 * k, n);
				const c2 = divNearest2(-b1 * k, n);
				let k1 = mod2(k - c1 * a1 - c2 * a2, n);
				let k2 = mod2(-c1 * b1 - c2 * b2, n);
				const k1neg = k1 > POW_2_128;
				const k2neg = k2 > POW_2_128;
				if (k1neg) k1 = n - k1;
				if (k2neg) k2 = n - k2;
				if (k1 > POW_2_128 || k2 > POW_2_128) {
					throw new Error("splitScalar: Endomorphism failed, k=" + k);
				}
				return { k1neg, k1, k2neg, k2 };
			},
		},
	},
	sha2563,
);
var _0n10 = BigInt(0);
var TAGGED_HASH_PREFIXES2 = {};
function taggedHash2(tag, ...messages) {
	let tagP = TAGGED_HASH_PREFIXES2[tag];
	if (tagP === undefined) {
		const tagH = sha2563(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
		tagP = concatBytes5(tagH, tagH);
		TAGGED_HASH_PREFIXES2[tag] = tagP;
	}
	return sha2563(concatBytes5(tagP, ...messages));
}
var pointToBytes2 = (point) => point.toRawBytes(true).slice(1);
var numTo32b2 = (n) => numberToBytesBE2(n, 32);
var modP2 = (x) => mod2(x, secp256k1P2);
var modN2 = (x) => mod2(x, secp256k1N2);
var Point2 = secp256k12.ProjectivePoint;
var GmulAdd2 = (Q, a, b) => Point2.BASE.multiplyAndAddUnsafe(Q, a, b);
function schnorrGetExtPubKey2(priv) {
	const d_ = secp256k12.utils.normPrivateKeyToScalar(priv);
	const p = Point2.fromPrivateKey(d_);
	const scalar = p.hasEvenY() ? d_ : modN2(-d_);
	return { scalar, bytes: pointToBytes2(p) };
}
function lift_x2(x) {
	aInRange("x", x, _1n10, secp256k1P2);
	const xx = modP2(x * x);
	const c = modP2(xx * x + BigInt(7));
	let y = sqrtMod2(c);
	if (y % _2n7 !== _0n10) y = modP2(-y);
	const p = new Point2(x, y, _1n10);
	p.assertValidity();
	return p;
}
var num = bytesToNumberBE2;
function challenge2(...args) {
	return modN2(num(taggedHash2("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey2(privateKey) {
	return schnorrGetExtPubKey2(privateKey).bytes;
}
function schnorrSign2(message, privateKey, auxRand = randomBytes3(32)) {
	const m = ensureBytes2("message", message);
	const { bytes: px, scalar: d } = schnorrGetExtPubKey2(privateKey);
	const a = ensureBytes2("auxRand", auxRand, 32);
	const t = numTo32b2(d ^ num(taggedHash2("BIP0340/aux", a)));
	const rand = taggedHash2("BIP0340/nonce", t, px, m);
	const k_ = modN2(num(rand));
	if (k_ === _0n10) throw new Error("sign failed: k is zero");
	const { bytes: rx, scalar: k } = schnorrGetExtPubKey2(k_);
	const e = challenge2(rx, px, m);
	const sig = new Uint8Array(64);
	sig.set(rx, 0);
	sig.set(numTo32b2(modN2(k + e * d)), 32);
	if (!schnorrVerify2(sig, m, px))
		throw new Error("sign: Invalid signature produced");
	return sig;
}
function schnorrVerify2(signature, message, publicKey) {
	const sig = ensureBytes2("signature", signature, 64);
	const m = ensureBytes2("message", message);
	const pub = ensureBytes2("publicKey", publicKey, 32);
	try {
		const P = lift_x2(num(pub));
		const r = num(sig.subarray(0, 32));
		if (!inRange(r, _1n10, secp256k1P2)) return false;
		const s = num(sig.subarray(32, 64));
		if (!inRange(s, _1n10, secp256k1N2)) return false;
		const e = challenge2(numTo32b2(r), pointToBytes2(P), m);
		const R = GmulAdd2(P, s, modN2(-e));
		if (!R || !R.hasEvenY() || R.toAffine().x !== r) return false;
		return true;
	} catch (error) {
		return false;
	}
}
var schnorr2 = /* @__PURE__ */ (() => ({
	getPublicKey: schnorrGetPublicKey2,
	sign: schnorrSign2,
	verify: schnorrVerify2,
	utils: {
		randomPrivateKey: secp256k12.utils.randomPrivateKey,
		lift_x: lift_x2,
		pointToBytes: pointToBytes2,
		numberToBytesBE: numberToBytesBE2,
		bytesToNumberBE: bytesToNumberBE2,
		taggedHash: taggedHash2,
		mod: mod2,
	},
}))();

// node_modules/@noble/hashes/esm/sha256.js
var sha2564 = sha2563;

// node_modules/@nostr-dev-kit/ndk/dist/index.mjs
var import_typescript_lru_cache = __toESM(require_dist(), 1);
var import_tseep3 = __toESM(require_lib(), 1);
var import_tseep4 = __toESM(require_lib(), 1);
var import_debug4 = __toESM(require_src(), 1);
var import_debug5 = __toESM(require_src(), 1);
var import_debug6 = __toESM(require_src(), 1);
var import_debug7 = __toESM(require_src(), 1);
var import_debug8 = __toESM(require_src(), 1);
var import_tseep5 = __toESM(require_lib(), 1);
var import_tseep6 = __toESM(require_lib(), 1);
var import_debug9 = __toESM(require_src(), 1);
var import_tseep7 = __toESM(require_lib(), 1);
var import_tseep8 = __toESM(require_lib(), 1);
var import_typescript_lru_cache2 = __toESM(require_dist(), 1);
var import_debug10 = __toESM(require_src(), 1);
var import_light_bolt11_decoder = __toESM(require_bolt11(), 1);
var import_debug11 = __toESM(require_src(), 1);
var import_tseep9 = __toESM(require_lib(), 1);
var import_debug12 = __toESM(require_src(), 1);
function getRelaysForSync(ndk, author, type = "write") {
	if (!ndk.outboxTracker) return;
	const item = ndk.outboxTracker.data.get(author);
	if (!item) return;
	if (type === "write") {
		return item.writeRelays;
	}
	return item.readRelays;
}
async function getWriteRelaysFor(ndk, author, type = "write") {
	if (!ndk.outboxTracker) return;
	if (!ndk.outboxTracker.data.has(author)) {
		await ndk.outboxTracker.trackUsers([author]);
	}
	return getRelaysForSync(ndk, author, type);
}
function getTopRelaysForAuthors(ndk, authors) {
	const relaysWithCount = /* @__PURE__ */ new Map();
	authors.forEach((author) => {
		const writeRelays = getRelaysForSync(ndk, author);
		if (writeRelays) {
			writeRelays.forEach((relay) => {
				const count = relaysWithCount.get(relay) || 0;
				relaysWithCount.set(relay, count + 1);
			});
		}
	});
	const sortedRelays = Array.from(relaysWithCount.entries()).sort(
		(a, b) => b[1] - a[1],
	);
	return sortedRelays.map((entry) => entry[0]);
}
function getAllRelaysForAllPubkeys(ndk, pubkeys, type = "read") {
	const pubkeysToRelays = /* @__PURE__ */ new Map();
	const authorsMissingRelays = /* @__PURE__ */ new Set();
	pubkeys.forEach((pubkey) => {
		const relays = getRelaysForSync(ndk, pubkey, type);
		if (relays && relays.size > 0) {
			relays.forEach((relay) => {
				const pubkeysInRelay =
					pubkeysToRelays.get(relay) || /* @__PURE__ */ new Set();
				pubkeysInRelay.add(pubkey);
			});
			pubkeysToRelays.set(pubkey, relays);
		} else {
			authorsMissingRelays.add(pubkey);
		}
	});
	return { pubkeysToRelays, authorsMissingRelays };
}
function chooseRelayCombinationForPubkeys(
	ndk,
	pubkeys,
	type,
	{ count, preferredRelays } = {},
) {
	count ??= 2;
	preferredRelays ??= /* @__PURE__ */ new Set();
	const pool = ndk.pool;
	const connectedRelays = pool.connectedRelays();
	connectedRelays.forEach((relay) => {
		preferredRelays?.add(relay.url);
	});
	const relayToAuthorsMap = /* @__PURE__ */ new Map();
	const { pubkeysToRelays, authorsMissingRelays } = getAllRelaysForAllPubkeys(
		ndk,
		pubkeys,
		type,
	);
	const sortedRelays = getTopRelaysForAuthors(ndk, pubkeys);
	const addAuthorToRelay = (author, relay) => {
		const authorsInRelay = relayToAuthorsMap.get(relay) || [];
		authorsInRelay.push(author);
		relayToAuthorsMap.set(relay, authorsInRelay);
	};
	for (const [author, authorRelays] of pubkeysToRelays.entries()) {
		let missingRelayCount = count;
		for (const relay of connectedRelays) {
			if (authorRelays.has(relay.url)) {
				addAuthorToRelay(author, relay.url);
				missingRelayCount--;
			}
		}
		for (const authorRelay of authorRelays) {
			if (relayToAuthorsMap.has(authorRelay)) {
				addAuthorToRelay(author, authorRelay);
				missingRelayCount--;
			}
		}
		if (missingRelayCount <= 0) continue;
		for (const relay of sortedRelays) {
			if (missingRelayCount <= 0) break;
			if (authorRelays.has(relay)) {
				addAuthorToRelay(author, relay);
				missingRelayCount--;
			}
		}
	}
	for (const author of authorsMissingRelays) {
		pool.permanentAndConnectedRelays().forEach((relay) => {
			const authorsInRelay = relayToAuthorsMap.get(relay.url) || [];
			authorsInRelay.push(author);
			relayToAuthorsMap.set(relay.url, authorsInRelay);
		});
	}
	return relayToAuthorsMap;
}
function getRelaysForFilterWithAuthors(ndk, authors, relayGoalPerAuthor = 2) {
	return chooseRelayCombinationForPubkeys(ndk, authors, "write", {
		count: relayGoalPerAuthor,
	});
}
function tryNormalizeRelayUrl(url) {
	try {
		return normalizeRelayUrl(url);
	} catch {
		return;
	}
}
function normalizeRelayUrl(url) {
	let r = normalizeUrl(url, {
		stripAuthentication: false,
		stripWWW: false,
		stripHash: true,
	});
	if (!r.endsWith("/")) {
		r += "/";
	}
	return r;
}
function normalize2(urls) {
	const normalized = /* @__PURE__ */ new Set();
	for (const url of urls) {
		try {
			normalized.add(normalizeRelayUrl(url));
		} catch {}
	}
	return Array.from(normalized);
}
var DATA_URL_DEFAULT_MIME_TYPE = "text/plain";
var DATA_URL_DEFAULT_CHARSET = "us-ascii";
var testParameter = (name, filters) =>
	filters.some((filter) =>
		filter instanceof RegExp ? filter.test(name) : filter === name,
	);
var supportedProtocols = /* @__PURE__ */ new Set(["https:", "http:", "file:"]);
var hasCustomProtocol = (urlString) => {
	try {
		const { protocol } = new URL(urlString);
		return (
			protocol.endsWith(":") &&
			!protocol.includes(".") &&
			!supportedProtocols.has(protocol)
		);
	} catch {
		return false;
	}
};
var normalizeDataURL = (urlString, { stripHash }) => {
	const match = /^data:(?<type>[^,]*?),(?<data>[^#]*?)(?:#(?<hash>.*))?$/.exec(
		urlString,
	);
	if (!match) {
		throw new Error(`Invalid URL: ${urlString}`);
	}
	const type = match.groups?.type ?? "";
	const data = match.groups?.data ?? "";
	let hash3 = match.groups?.hash ?? "";
	const mediaType = type.split(";");
	hash3 = stripHash ? "" : hash3;
	let isBase64 = false;
	if (mediaType[mediaType.length - 1] === "base64") {
		mediaType.pop();
		isBase64 = true;
	}
	const mimeType = mediaType.shift()?.toLowerCase() ?? "";
	const attributes = mediaType
		.map((attribute) => {
			let [key, value = ""] = attribute
				.split("=")
				.map((string) => string.trim());
			if (key === "charset") {
				value = value.toLowerCase();
				if (value === DATA_URL_DEFAULT_CHARSET) {
					return "";
				}
			}
			return `${key}${value ? `=${value}` : ""}`;
		})
		.filter(Boolean);
	const normalizedMediaType = [...attributes];
	if (isBase64) {
		normalizedMediaType.push("base64");
	}
	if (
		normalizedMediaType.length > 0 ||
		(mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE)
	) {
		normalizedMediaType.unshift(mimeType);
	}
	return `data:${normalizedMediaType.join(";")},${isBase64 ? data.trim() : data}${hash3 ? `#${hash3}` : ""}`;
};
function normalizeUrl(urlString, options = {}) {
	options = {
		defaultProtocol: "http",
		normalizeProtocol: true,
		forceHttp: false,
		forceHttps: false,
		stripAuthentication: true,
		stripHash: false,
		stripTextFragment: true,
		stripWWW: true,
		removeQueryParameters: [/^utm_\w+/i],
		removeTrailingSlash: true,
		removeSingleSlash: true,
		removeDirectoryIndex: false,
		removeExplicitPort: false,
		sortQueryParameters: true,
		...options,
	};
	if (
		typeof options.defaultProtocol === "string" &&
		!options.defaultProtocol.endsWith(":")
	) {
		options.defaultProtocol = `${options.defaultProtocol}:`;
	}
	urlString = urlString.trim();
	if (/^data:/i.test(urlString)) {
		return normalizeDataURL(urlString, options);
	}
	if (hasCustomProtocol(urlString)) {
		return urlString;
	}
	const hasRelativeProtocol = urlString.startsWith("//");
	const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);
	if (!isRelativeUrl) {
		urlString = urlString.replace(
			/^(?!(?:\w+:)?\/\/)|^\/\//,
			options.defaultProtocol,
		);
	}
	const urlObject = new URL(urlString);
	urlObject.hostname = urlObject.hostname.toLowerCase();
	if (options.forceHttp && options.forceHttps) {
		throw new Error(
			"The `forceHttp` and `forceHttps` options cannot be used together",
		);
	}
	if (options.forceHttp && urlObject.protocol === "https:") {
		urlObject.protocol = "http:";
	}
	if (options.forceHttps && urlObject.protocol === "http:") {
		urlObject.protocol = "https:";
	}
	if (options.stripAuthentication) {
		urlObject.username = "";
		urlObject.password = "";
	}
	if (options.stripHash) {
		urlObject.hash = "";
	} else if (options.stripTextFragment) {
		urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, "");
	}
	if (urlObject.pathname) {
		const protocolRegex = /\b[a-z][a-z\d+\-.]{1,50}:\/\//g;
		let lastIndex = 0;
		let result = "";
		for (;;) {
			const match = protocolRegex.exec(urlObject.pathname);
			if (!match) {
				break;
			}
			const protocol = match[0];
			const protocolAtIndex = match.index;
			const intermediate = urlObject.pathname.slice(lastIndex, protocolAtIndex);
			result += intermediate.replace(/\/{2,}/g, "/");
			result += protocol;
			lastIndex = protocolAtIndex + protocol.length;
		}
		const remnant = urlObject.pathname.slice(
			lastIndex,
			urlObject.pathname.length,
		);
		result += remnant.replace(/\/{2,}/g, "/");
		urlObject.pathname = result;
	}
	if (urlObject.pathname) {
		try {
			urlObject.pathname = decodeURI(urlObject.pathname);
		} catch {}
	}
	if (options.removeDirectoryIndex === true) {
		options.removeDirectoryIndex = [/^index\.[a-z]+$/];
	}
	if (
		Array.isArray(options.removeDirectoryIndex) &&
		options.removeDirectoryIndex.length > 0
	) {
		let pathComponents = urlObject.pathname.split("/");
		const lastComponent = pathComponents[pathComponents.length - 1];
		if (testParameter(lastComponent, options.removeDirectoryIndex)) {
			pathComponents = pathComponents.slice(0, -1);
			urlObject.pathname = `${pathComponents.slice(1).join("/")}/`;
		}
	}
	if (urlObject.hostname) {
		urlObject.hostname = urlObject.hostname.replace(/\.$/, "");
		if (
			options.stripWWW &&
			/^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(
				urlObject.hostname,
			)
		) {
			urlObject.hostname = urlObject.hostname.replace(/^www\./, "");
		}
	}
	if (Array.isArray(options.removeQueryParameters)) {
		for (const key of [...urlObject.searchParams.keys()]) {
			if (testParameter(key, options.removeQueryParameters)) {
				urlObject.searchParams.delete(key);
			}
		}
	}
	if (
		!Array.isArray(options.keepQueryParameters) &&
		options.removeQueryParameters === true
	) {
		urlObject.search = "";
	}
	if (
		Array.isArray(options.keepQueryParameters) &&
		options.keepQueryParameters.length > 0
	) {
		for (const key of [...urlObject.searchParams.keys()]) {
			if (!testParameter(key, options.keepQueryParameters)) {
				urlObject.searchParams.delete(key);
			}
		}
	}
	if (options.sortQueryParameters) {
		urlObject.searchParams.sort();
		try {
			urlObject.search = decodeURIComponent(urlObject.search);
		} catch {}
	}
	if (options.removeTrailingSlash) {
		urlObject.pathname = urlObject.pathname.replace(/\/$/, "");
	}
	if (options.removeExplicitPort && urlObject.port) {
		urlObject.port = "";
	}
	const oldUrlString = urlString;
	urlString = urlObject.toString();
	if (
		!options.removeSingleSlash &&
		urlObject.pathname === "/" &&
		!oldUrlString.endsWith("/") &&
		urlObject.hash === ""
	) {
		urlString = urlString.replace(/\/$/, "");
	}
	if (
		(options.removeTrailingSlash || urlObject.pathname === "/") &&
		urlObject.hash === "" &&
		options.removeSingleSlash
	) {
		urlString = urlString.replace(/\/$/, "");
	}
	if (hasRelativeProtocol && !options.normalizeProtocol) {
		urlString = urlString.replace(/^http:\/\//, "//");
	}
	if (options.stripProtocol) {
		urlString = urlString.replace(/^(?:https?:)?\/\//, "");
	}
	return urlString;
}
var MAX_RECONNECT_ATTEMPTS = 5;
var FLAPPING_THRESHOLD_MS = 1000;
var NDKRelayConnectivity = class {
	ndkRelay;
	ws;
	_status;
	timeoutMs;
	connectedAt;
	_connectionStats = {
		attempts: 0,
		success: 0,
		durations: [],
	};
	debug;
	netDebug;
	connectTimeout;
	reconnectTimeout;
	ndk;
	openSubs = /* @__PURE__ */ new Map();
	openCountRequests = /* @__PURE__ */ new Map();
	openEventPublishes = /* @__PURE__ */ new Map();
	serial = 0;
	baseEoseTimeout = 4400;
	constructor(ndkRelay, ndk) {
		this.ndkRelay = ndkRelay;
		this._status = 1;
		const rand = Math.floor(Math.random() * 1000);
		this.debug = this.ndkRelay.debug.extend(`connectivity${rand}`);
		this.ndk = ndk;
	}
	async connect(timeoutMs, reconnect = true) {
		if (this._status !== 2 && this._status !== 1) {
			this.debug(
				"Relay requested to be connected but was in state %s or it had a reconnect timeout",
				this._status,
			);
			return;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = undefined;
		}
		if (this.connectTimeout) {
			clearTimeout(this.connectTimeout);
			this.connectTimeout = undefined;
		}
		timeoutMs ??= this.timeoutMs;
		if (!this.timeoutMs && timeoutMs) this.timeoutMs = timeoutMs;
		if (this.timeoutMs)
			this.connectTimeout = setTimeout(
				() => this.onConnectionError(reconnect),
				this.timeoutMs,
			);
		try {
			this.updateConnectionStats.attempt();
			if (this._status === 1) this._status = 4;
			else this._status = 2;
			this.ws = new WebSocket(this.ndkRelay.url);
			this.ws.onopen = this.onConnect.bind(this);
			this.ws.onclose = this.onDisconnect.bind(this);
			this.ws.onmessage = this.onMessage.bind(this);
			this.ws.onerror = this.onError.bind(this);
		} catch (e) {
			this.debug(`Failed to connect to ${this.ndkRelay.url}`, e);
			this._status = 1;
			if (reconnect) this.handleReconnection();
			else this.ndkRelay.emit("delayed-connect", 2 * 24 * 60 * 60 * 1000);
			throw e;
		}
	}
	disconnect() {
		this._status = 0;
		try {
			this.ws?.close();
		} catch (e) {
			this.debug("Failed to disconnect", e);
			this._status = 1;
		}
	}
	onConnectionError(reconnect) {
		this.debug(`Error connecting to ${this.ndkRelay.url}`, this.timeoutMs);
		if (reconnect && !this.reconnectTimeout) {
			this.handleReconnection();
		}
	}
	onConnect() {
		this.netDebug?.("connected", this.ndkRelay);
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = undefined;
		}
		if (this.connectTimeout) {
			clearTimeout(this.connectTimeout);
			this.connectTimeout = undefined;
		}
		this.updateConnectionStats.connected();
		this._status = 5;
		this.ndkRelay.emit("connect");
		this.ndkRelay.emit("ready");
	}
	onDisconnect() {
		this.netDebug?.("disconnected", this.ndkRelay);
		this.updateConnectionStats.disconnected();
		if (this._status === 5) {
			this.handleReconnection();
		}
		this._status = 1;
		this.ndkRelay.emit("disconnect");
	}
	onMessage(event) {
		this.netDebug?.(event.data, this.ndkRelay, "recv");
		try {
			const data = JSON.parse(event.data);
			const [cmd, id, ..._rest] = data;
			switch (cmd) {
				case "EVENT": {
					const so = this.openSubs.get(id);
					const event2 = data[2];
					if (!so) {
						this.debug(`Received event for unknown subscription ${id}`);
						return;
					}
					so.onevent(event2);
					return;
				}
				case "COUNT": {
					const payload = data[2];
					const cr = this.openCountRequests.get(id);
					if (cr) {
						cr.resolve(payload.count);
						this.openCountRequests.delete(id);
					}
					return;
				}
				case "EOSE": {
					const so = this.openSubs.get(id);
					if (!so) return;
					so.oneose(id);
					return;
				}
				case "OK": {
					const ok = data[2];
					const reason = data[3];
					const ep = this.openEventPublishes.get(id);
					const firstEp = ep?.pop();
					if (!ep || !firstEp) {
						this.debug("Received OK for unknown event publish", id);
						return;
					}
					if (ok) firstEp.resolve(reason);
					else firstEp.reject(new Error(reason));
					if (ep.length === 0) {
						this.openEventPublishes.delete(id);
					} else {
						this.openEventPublishes.set(id, ep);
					}
					return;
				}
				case "CLOSED": {
					const so = this.openSubs.get(id);
					if (!so) return;
					so.onclosed(data[2]);
					return;
				}
				case "NOTICE":
					this.onNotice(data[1]);
					return;
				case "AUTH": {
					this.onAuthRequested(data[1]);
					return;
				}
			}
		} catch (error) {
			this.debug(
				`Error parsing message from ${this.ndkRelay.url}: ${error.message}`,
				error?.stack,
			);
			return;
		}
	}
	async onAuthRequested(challenge3) {
		const authPolicy =
			this.ndkRelay.authPolicy ?? this.ndk?.relayAuthDefaultPolicy;
		this.debug("Relay requested authentication", {
			havePolicy: !!authPolicy,
		});
		if (this._status === 7) {
			this.debug("Already authenticating, ignoring");
			return;
		}
		this._status = 6;
		if (authPolicy) {
			if (this._status >= 5) {
				this._status = 7;
				let res;
				try {
					res = await authPolicy(this.ndkRelay, challenge3);
				} catch (e) {
					this.debug("Authentication policy threw an error", e);
					res = false;
				}
				this.debug("Authentication policy returned", !!res);
				if (res instanceof NDKEvent || res === true) {
					if (res instanceof NDKEvent) {
						await this.auth(res);
					}
					const authenticate = async () => {
						if (this._status >= 5 && this._status < 8) {
							const event = new NDKEvent(this.ndk);
							event.kind = 22242;
							event.tags = [
								["relay", this.ndkRelay.url],
								["challenge", challenge3],
							];
							await event.sign();
							this.auth(event)
								.then(() => {
									this._status = 8;
									this.ndkRelay.emit("authed");
									this.debug("Authentication successful");
								})
								.catch((e) => {
									this._status = 6;
									this.ndkRelay.emit("auth:failed", e);
									this.debug("Authentication failed", e);
								});
						} else {
							this.debug(
								"Authentication failed, it changed status, status is %d",
								this._status,
							);
						}
					};
					if (res === true) {
						if (!this.ndk?.signer) {
							this.debug("No signer available for authentication localhost");
							this.ndk?.once("signer:ready", authenticate);
						} else {
							authenticate().catch((e) => {
								console.error("Error authenticating", e);
							});
						}
					}
					this._status = 5;
					this.ndkRelay.emit("authed");
				}
			}
		} else {
			this.ndkRelay.emit("auth", challenge3);
		}
	}
	onError(error) {
		this.debug(`WebSocket error on ${this.ndkRelay.url}:`, error);
	}
	get status() {
		return this._status;
	}
	isAvailable() {
		return this._status === 5;
	}
	isFlapping() {
		const durations = this._connectionStats.durations;
		if (durations.length % 3 !== 0) return false;
		const sum = durations.reduce((a, b) => a + b, 0);
		const avg = sum / durations.length;
		const variance =
			durations.map((x) => (x - avg) ** 2).reduce((a, b) => a + b, 0) /
			durations.length;
		const stdDev = Math.sqrt(variance);
		const isFlapping = stdDev < FLAPPING_THRESHOLD_MS;
		return isFlapping;
	}
	async onNotice(notice) {
		this.ndkRelay.emit("notice", notice);
	}
	handleReconnection(attempt = 0) {
		if (this.reconnectTimeout) return;
		if (this.isFlapping()) {
			this.ndkRelay.emit("flapping", this._connectionStats);
			this._status = 3;
			return;
		}
		const reconnectDelay = this.connectedAt
			? Math.max(0, 60000 - (Date.now() - this.connectedAt))
			: 5000 * (this._connectionStats.attempts + 1);
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = undefined;
			this._status = 2;
			this.connect().catch((_err) => {
				if (attempt < MAX_RECONNECT_ATTEMPTS) {
					setTimeout(
						() => {
							this.handleReconnection(attempt + 1);
						},
						(1000 * (attempt + 1)) ^ 4,
					);
				} else {
					this.debug("Reconnect failed");
				}
			});
		}, reconnectDelay);
		this.ndkRelay.emit("delayed-connect", reconnectDelay);
		this.debug("Reconnecting in", reconnectDelay);
		this._connectionStats.nextReconnectAt = Date.now() + reconnectDelay;
	}
	async send(message) {
		if (this._status >= 5 && this.ws?.readyState === WebSocket.OPEN) {
			this.ws?.send(message);
			this.netDebug?.(message, this.ndkRelay, "send");
		} else {
			this.debug(
				`Not connected to ${this.ndkRelay.url} (%d), not sending message ${message}`,
				this._status,
			);
		}
	}
	async auth(event) {
		const ret = new Promise((resolve, reject) => {
			const val = this.openEventPublishes.get(event.id) ?? [];
			val.push({ resolve, reject });
			this.openEventPublishes.set(event.id, val);
		});
		this.send(`["AUTH",${JSON.stringify(event.rawEvent())}]`);
		return ret;
	}
	async publish(event) {
		const ret = new Promise((resolve, reject) => {
			const val = this.openEventPublishes.get(event.id) ?? [];
			if (val.length > 0) {
				console.warn(
					`Duplicate event publishing detected, you are publishing event ${event.id} twice`,
				);
			}
			val.push({ resolve, reject });
			this.openEventPublishes.set(event.id, val);
		});
		this.send(`["EVENT",${JSON.stringify(event)}]`);
		return ret;
	}
	async count(filters, params) {
		this.serial++;
		const id = params?.id || `count:${this.serial}`;
		const ret = new Promise((resolve, reject) => {
			this.openCountRequests.set(id, { resolve, reject });
		});
		this.send(`["COUNT","${id}",${JSON.stringify(filters).substring(1)}`);
		return ret;
	}
	close(subId, reason) {
		this.send(`["CLOSE","${subId}"]`);
		const sub = this.openSubs.get(subId);
		this.openSubs.delete(subId);
		if (sub) sub.onclose(reason);
	}
	req(relaySub) {
		`${this.send(`["REQ","${relaySub.subId}",${JSON.stringify(relaySub.executeFilters).substring(1)}`)}]`;
		this.openSubs.set(relaySub.subId, relaySub);
	}
	updateConnectionStats = {
		connected: () => {
			this._connectionStats.success++;
			this._connectionStats.connectedAt = Date.now();
		},
		disconnected: () => {
			if (this._connectionStats.connectedAt) {
				this._connectionStats.durations.push(
					Date.now() - this._connectionStats.connectedAt,
				);
				if (this._connectionStats.durations.length > 100) {
					this._connectionStats.durations.shift();
				}
			}
			this._connectionStats.connectedAt = undefined;
		},
		attempt: () => {
			this._connectionStats.attempts++;
			this._connectionStats.connectedAt = Date.now();
		},
	};
	get connectionStats() {
		return this._connectionStats;
	}
	get url() {
		return this.ndkRelay.url;
	}
	get connected() {
		return this._status >= 5 && this.ws?.readyState === WebSocket.OPEN;
	}
};
var NDKRelayPublisher = class {
	ndkRelay;
	debug;
	constructor(ndkRelay) {
		this.ndkRelay = ndkRelay;
		this.debug = ndkRelay.debug.extend("publisher");
	}
	async publish(event, timeoutMs = 2500) {
		let timeout;
		const publishConnected = () => {
			return new Promise((resolve, reject) => {
				try {
					this.publishEvent(event)
						.then((_result) => {
							this.ndkRelay.emit("published", event);
							event.emit("relay:published", this.ndkRelay);
							resolve(true);
						})
						.catch(reject);
				} catch (err) {
					reject(err);
				}
			});
		};
		const timeoutPromise = new Promise((_, reject) => {
			timeout = setTimeout(() => {
				timeout = undefined;
				reject(new Error(`Timeout: ${timeoutMs}ms`));
			}, timeoutMs);
		});
		const onConnectHandler = () => {
			publishConnected()
				.then((result) => connectResolve(result))
				.catch((err) => connectReject(err));
		};
		let connectResolve;
		let connectReject;
		const onError = (err) => {
			this.ndkRelay.debug("Publish failed", err, event.id);
			this.ndkRelay.emit("publish:failed", event, err);
			event.emit("relay:publish:failed", this.ndkRelay, err);
			throw err;
		};
		const onFinally = () => {
			if (timeout) clearTimeout(timeout);
			this.ndkRelay.removeListener("connect", onConnectHandler);
		};
		if (this.ndkRelay.status >= 5) {
			return Promise.race([publishConnected(), timeoutPromise])
				.catch(onError)
				.finally(onFinally);
		}
		if (this.ndkRelay.status <= 1) {
			console.warn(
				"Relay is disconnected, trying to connect to publish an event",
				this.ndkRelay.url,
			);
			this.ndkRelay.connect();
		} else {
			console.warn(
				"Relay not connected, waiting for connection to publish an event",
				this.ndkRelay.url,
			);
		}
		return Promise.race([
			new Promise((resolve, reject) => {
				connectResolve = resolve;
				connectReject = reject;
				this.ndkRelay.on("connect", onConnectHandler);
			}),
			timeoutPromise,
		])
			.catch(onError)
			.finally(onFinally);
	}
	async publishEvent(event) {
		return this.ndkRelay.connectivity.publish(event.rawEvent());
	}
};
function filterFingerprint(filters, closeOnEose) {
	const elements = [];
	for (const filter of filters) {
		const keys = Object.entries(filter || {})
			.map(([key, values]) => {
				if (["since", "until"].includes(key)) {
					return `${key}:${values}`;
				}
				return key;
			})
			.sort()
			.join("-");
		elements.push(keys);
	}
	let id = closeOnEose ? "+" : "";
	id += elements.join("|");
	return id;
}
function mergeFilters(filters) {
	const result = [];
	const lastResult = {};
	filters
		.filter((f) => !!f.limit)
		.forEach((filterWithLimit) => result.push(filterWithLimit));
	filters = filters.filter((f) => !f.limit);
	if (filters.length === 0) return result;
	filters.forEach((filter) => {
		Object.entries(filter).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				if (lastResult[key] === undefined) {
					lastResult[key] = [...value];
				} else {
					lastResult[key] = Array.from(
						/* @__PURE__ */ new Set([...lastResult[key], ...value]),
					);
				}
			} else {
				lastResult[key] = value;
			}
		});
	});
	return [...result, lastResult];
}
var NDKRelaySubscription = class {
	fingerprint;
	items = /* @__PURE__ */ new Map();
	topSubManager;
	debug;
	status = 0;
	onClose;
	relay;
	eosed = false;
	executionTimer;
	fireTime;
	delayType;
	executeFilters;
	id = Math.random().toString(36).substring(7);
	constructor(relay, fingerprint, topSubManager) {
		this.relay = relay;
		this.topSubManager = topSubManager;
		this.debug = relay.debug.extend(`sub[${this.id}]`);
		this.fingerprint = fingerprint || Math.random().toString(36).substring(7);
	}
	_subId;
	get subId() {
		if (this._subId) return this._subId;
		this._subId = this.fingerprint.slice(0, 15);
		return this._subId;
	}
	subIdParts = /* @__PURE__ */ new Set();
	addSubIdPart(part) {
		this.subIdParts.add(part);
	}
	addItem(subscription, filters) {
		this.debug("Adding item", {
			filters,
			internalId: subscription.internalId,
			status: this.status,
			fingerprint: this.fingerprint,
			id: this.subId,
			items: this.items,
			itemsSize: this.items.size,
		});
		if (this.items.has(subscription.internalId)) return;
		subscription.on("close", this.removeItem.bind(this, subscription));
		this.items.set(subscription.internalId, { subscription, filters });
		if (this.status !== 3) {
			if (subscription.subId && (!this._subId || this._subId.length < 48)) {
				if (this.status === 0 || this.status === 1) {
					this.addSubIdPart(subscription.subId);
				}
			}
		}
		switch (this.status) {
			case 0:
				this.evaluateExecutionPlan(subscription);
				break;
			case 3:
				break;
			case 1:
				this.evaluateExecutionPlan(subscription);
				break;
			case 4:
				this.debug(
					"Subscription is closed, cannot add new items %o (%o)",
					subscription,
					filters,
				);
				throw new Error("Cannot add new items to a closed subscription");
		}
	}
	removeItem(subscription) {
		this.items.delete(subscription.internalId);
		if (this.items.size === 0) {
			if (!this.eosed) return;
			this.close();
			this.cleanup();
		}
	}
	close() {
		if (this.status === 4) return;
		const prevStatus = this.status;
		this.status = 4;
		if (prevStatus === 3) {
			try {
				this.relay.close(this.subId);
			} catch (e) {
				this.debug("Error closing subscription", e, this);
			}
		} else {
			this.debug(
				"Subscription wanted to close but it wasn't running, this is probably ok",
				{
					subId: this.subId,
					prevStatus,
					sub: this,
				},
			);
		}
		this.cleanup();
	}
	cleanup() {
		if (this.executionTimer) clearTimeout(this.executionTimer);
		this.relay.off("ready", this.executeOnRelayReady);
		this.relay.off("authed", this.reExecuteAfterAuth);
		if (this.onClose) this.onClose(this);
	}
	evaluateExecutionPlan(subscription) {
		if (!subscription.isGroupable()) {
			this.status = 1;
			this.execute();
			return;
		}
		if (subscription.filters.find((filter) => !!filter.limit)) {
			this.executeFilters = this.compileFilters();
			if (this.executeFilters.length >= 10) {
				this.status = 1;
				this.execute();
				return;
			}
		}
		const delay = subscription.groupableDelay;
		const delayType = subscription.groupableDelayType;
		if (!delay) throw new Error("Cannot group a subscription without a delay");
		if (this.status === 0) {
			this.schedule(delay, delayType);
		} else {
			const existingDelayType = this.delayType;
			const timeUntilFire = this.fireTime - Date.now();
			if (existingDelayType === "at-least" && delayType === "at-least") {
				if (timeUntilFire < delay) {
					if (this.executionTimer) clearTimeout(this.executionTimer);
					this.schedule(delay, delayType);
				}
			} else if (existingDelayType === "at-least" && delayType === "at-most") {
				if (timeUntilFire > delay) {
					if (this.executionTimer) clearTimeout(this.executionTimer);
					this.schedule(delay, delayType);
				}
			} else if (existingDelayType === "at-most" && delayType === "at-most") {
				if (timeUntilFire > delay) {
					if (this.executionTimer) clearTimeout(this.executionTimer);
					this.schedule(delay, delayType);
				}
			} else if (existingDelayType === "at-most" && delayType === "at-least") {
				if (timeUntilFire > delay) {
					if (this.executionTimer) clearTimeout(this.executionTimer);
					this.schedule(delay, delayType);
				}
			} else {
				throw new Error(
					`Unknown delay type combination ${existingDelayType} ${delayType}`,
				);
			}
		}
	}
	schedule(delay, delayType) {
		this.status = 1;
		const currentTime = Date.now();
		this.fireTime = currentTime + delay;
		this.delayType = delayType;
		const timer = setTimeout(this.execute.bind(this), delay);
		if (delayType === "at-least") {
			this.executionTimer = timer;
		}
	}
	executeOnRelayReady = () => {
		if (this.status !== 2) return;
		if (this.items.size === 0) {
			this.debug(
				"No items to execute; this relay was probably too slow to respond and the caller gave up",
				{
					status: this.status,
					fingerprint: this.fingerprint,
					items: this.items,
					itemsSize: this.items.size,
					id: this.id,
					subId: this.subId,
				},
			);
			this.cleanup();
			return;
		}
		this.debug("Executing on relay ready", {
			status: this.status,
			fingerprint: this.fingerprint,
			items: this.items,
			itemsSize: this.items.size,
		});
		this.status = 1;
		this.execute();
	};
	finalizeSubId() {
		if (this.subIdParts.size > 0) {
			this._subId = Array.from(this.subIdParts).join("-");
		} else {
			this._subId = this.fingerprint.slice(0, 15);
		}
		this._subId += `-${Math.random().toString(36).substring(2, 7)}`;
	}
	reExecuteAfterAuth = (() => {
		const oldSubId = this.subId;
		this.debug("Re-executing after auth", this.items.size);
		if (this.eosed) {
			this.relay.close(this.subId);
		} else {
			this.debug(
				"We are abandoning an opened subscription, once it EOSE's, the handler will close it",
				{
					oldSubId,
				},
			);
		}
		this._subId = undefined;
		this.status = 1;
		this.execute();
		this.debug(
			"Re-executed after auth %s \uD83D\uDC49 %s",
			oldSubId,
			this.subId,
		);
	}).bind(this);
	execute() {
		if (this.status !== 1) {
			return;
		}
		if (!this.relay.connected) {
			this.status = 2;
			this.debug("Waiting for relay to be ready", {
				status: this.status,
				id: this.subId,
				fingerprint: this.fingerprint,
				items: this.items,
				itemsSize: this.items.size,
			});
			this.relay.once("ready", this.executeOnRelayReady);
			return;
		}
		if (this.relay.status < 8) {
			this.relay.once("authed", this.reExecuteAfterAuth);
		}
		this.status = 3;
		this.finalizeSubId();
		this.executeFilters = this.compileFilters();
		this.relay.req(this);
	}
	onstart() {}
	onevent(event) {
		this.topSubManager.dispatchEvent(event, this.relay);
	}
	oneose(subId) {
		this.eosed = true;
		if (subId !== this.subId) {
			this.debug(
				"Received EOSE for an abandoned subscription",
				subId,
				this.subId,
			);
			this.relay.close(subId);
			return;
		}
		if (this.items.size === 0) {
			this.close();
		}
		for (const { subscription } of this.items.values()) {
			subscription.eoseReceived(this.relay);
			if (subscription.closeOnEose) {
				this.debug("Removing item because of EOSE", {
					filters: subscription.filters,
					internalId: subscription.internalId,
					status: this.status,
					fingerprint: this.fingerprint,
					items: this.items,
					itemsSize: this.items.size,
				});
				this.removeItem(subscription);
			}
		}
	}
	onclose(_reason) {
		this.status = 4;
	}
	onclosed(reason) {
		if (!reason) return;
		for (const { subscription } of this.items.values()) {
			subscription.closedReceived(this.relay, reason);
		}
	}
	compileFilters() {
		const mergedFilters = [];
		const filters = Array.from(this.items.values()).map((item) => item.filters);
		if (!filters[0]) {
			this.debug("\uD83D\uDC40 No filters to merge", this.items);
			console.error("BUG: No filters to merge!", this.items);
			return [];
		}
		const filterCount = filters[0].length;
		for (let i2 = 0; i2 < filterCount; i2++) {
			const allFiltersAtIndex = filters.map((filter) => filter[i2]);
			mergedFilters.push(...mergeFilters(allFiltersAtIndex));
		}
		return mergedFilters;
	}
};
var NDKRelaySubscriptionManager = class {
	relay;
	subscriptions;
	generalSubManager;
	constructor(relay, generalSubManager) {
		this.relay = relay;
		this.subscriptions = /* @__PURE__ */ new Map();
		this.generalSubManager = generalSubManager;
	}
	addSubscription(sub, filters) {
		let relaySub;
		if (!sub.isGroupable()) {
			relaySub = this.createSubscription(sub, filters);
		} else {
			const filterFp = filterFingerprint(filters, sub.closeOnEose);
			if (filterFp) {
				const existingSubs = this.subscriptions.get(filterFp);
				relaySub = (existingSubs || []).find((sub2) => sub2.status < 3);
			}
			relaySub ??= this.createSubscription(sub, filters, filterFp);
		}
		relaySub.addItem(sub, filters);
	}
	createSubscription(_sub, _filters, fingerprint) {
		const relaySub = new NDKRelaySubscription(
			this.relay,
			fingerprint || null,
			this.generalSubManager,
		);
		relaySub.onClose = this.onRelaySubscriptionClose.bind(this);
		const currentVal = this.subscriptions.get(relaySub.fingerprint) ?? [];
		this.subscriptions.set(relaySub.fingerprint, [...currentVal, relaySub]);
		return relaySub;
	}
	onRelaySubscriptionClose(sub) {
		let currentVal = this.subscriptions.get(sub.fingerprint) ?? [];
		if (!currentVal) {
			console.warn(
				"Unexpectedly did not find a subscription with fingerprint",
				sub.fingerprint,
			);
		} else if (currentVal.length === 1) {
			this.subscriptions.delete(sub.fingerprint);
		} else {
			currentVal = currentVal.filter((s) => s.id !== sub.id);
			this.subscriptions.set(sub.fingerprint, currentVal);
		}
	}
};
var NDKRelay = class _NDKRelay extends import_tseep2.EventEmitter {
	url;
	scores;
	connectivity;
	subs;
	publisher;
	authPolicy;
	lowestValidationRatio;
	targetValidationRatio;
	validationRatioFn;
	validatedEventCount = 0;
	nonValidatedEventCount = 0;
	trusted = false;
	complaining = false;
	debug;
	static defaultValidationRatioUpdateFn = (
		relay,
		validatedCount,
		_nonValidatedCount,
	) => {
		if (
			relay.lowestValidationRatio === undefined ||
			relay.targetValidationRatio === undefined
		)
			return 1;
		let newRatio = relay.validationRatio;
		if (relay.validationRatio > relay.targetValidationRatio) {
			const factor = validatedCount / 100;
			newRatio = Math.max(
				relay.lowestValidationRatio,
				relay.validationRatio - factor,
			);
		}
		if (newRatio < relay.validationRatio) {
			return newRatio;
		}
		return relay.validationRatio;
	};
	constructor(url, authPolicy, ndk) {
		super();
		this.url = normalizeRelayUrl(url);
		this.scores = /* @__PURE__ */ new Map();
		this.debug = import_debug2.default(`ndk:relay:${url}`);
		this.connectivity = new NDKRelayConnectivity(this, ndk);
		this.connectivity.netDebug = ndk?.netDebug;
		this.req = this.connectivity.req.bind(this.connectivity);
		this.close = this.connectivity.close.bind(this.connectivity);
		this.subs = new NDKRelaySubscriptionManager(this, ndk.subManager);
		this.publisher = new NDKRelayPublisher(this);
		this.authPolicy = authPolicy;
		this.targetValidationRatio = ndk?.initialValidationRatio;
		this.lowestValidationRatio = ndk?.lowestValidationRatio;
		this.validationRatioFn = (
			ndk?.validationRatioFn ?? _NDKRelay.defaultValidationRatioUpdateFn
		).bind(this);
		this.updateValidationRatio();
		if (!ndk) {
			console.trace("relay created without ndk");
		}
	}
	updateValidationRatio() {
		if (this.validationRatioFn && this.validatedEventCount > 0) {
			const newRatio = this.validationRatioFn(
				this,
				this.validatedEventCount,
				this.nonValidatedEventCount,
			);
			this.targetValidationRatio = newRatio;
		}
		setTimeout(() => {
			this.updateValidationRatio();
		}, 30000);
	}
	get status() {
		return this.connectivity.status;
	}
	get connectionStats() {
		return this.connectivity.connectionStats;
	}
	async connect(timeoutMs, reconnect = true) {
		return this.connectivity.connect(timeoutMs, reconnect);
	}
	disconnect() {
		if (this.status === 1) {
			return;
		}
		this.connectivity.disconnect();
	}
	subscribe(subscription, filters) {
		this.subs.addSubscription(subscription, filters);
	}
	async publish(event, timeoutMs = 2500) {
		return this.publisher.publish(event, timeoutMs);
	}
	referenceTags() {
		return [["r", this.url]];
	}
	addValidatedEvent() {
		this.validatedEventCount++;
	}
	addNonValidatedEvent() {
		this.nonValidatedEventCount++;
	}
	get validationRatio() {
		if (this.nonValidatedEventCount === 0) {
			return 1;
		}
		return (
			this.validatedEventCount /
			(this.validatedEventCount + this.nonValidatedEventCount)
		);
	}
	shouldValidateEvent() {
		if (this.trusted) {
			return false;
		}
		if (this.targetValidationRatio === undefined) {
			return true;
		}
		if (this.targetValidationRatio >= 1) return true;
		return Math.random() < this.targetValidationRatio;
	}
	get connected() {
		return this.connectivity.connected;
	}
	req;
	close;
};
var NDKPublishError = class extends Error {
	errors;
	publishedToRelays;
	intendedRelaySet;
	constructor(message, errors, publishedToRelays, intendedRelaySet) {
		super(message);
		this.errors = errors;
		this.publishedToRelays = publishedToRelays;
		this.intendedRelaySet = intendedRelaySet;
	}
	get relayErrors() {
		const errors = [];
		for (const [relay, err] of this.errors) {
			errors.push(`${relay.url}: ${err}`);
		}
		return errors.join(`
`);
	}
};
var NDKRelaySet = class _NDKRelaySet {
	relays;
	debug;
	ndk;
	pool;
	constructor(relays, ndk, pool) {
		this.relays = relays;
		this.ndk = ndk;
		this.pool = pool ?? ndk.pool;
		this.debug = ndk.debug.extend("relayset");
	}
	addRelay(relay) {
		this.relays.add(relay);
	}
	get relayUrls() {
		return Array.from(this.relays).map((r) => r.url);
	}
	static fromRelayUrls(relayUrls, ndk, connect = true, pool) {
		pool = pool ?? ndk.pool;
		if (!pool) throw new Error("No pool provided");
		const relays = /* @__PURE__ */ new Set();
		for (const url of relayUrls) {
			const relay = pool.relays.get(normalizeRelayUrl(url));
			if (relay) {
				if (relay.status < 5 && connect) {
					relay.connect();
				}
				relays.add(relay);
			} else {
				const temporaryRelay = new NDKRelay(
					normalizeRelayUrl(url),
					ndk?.relayAuthDefaultPolicy,
					ndk,
				);
				pool.useTemporaryRelay(
					temporaryRelay,
					undefined,
					`requested from fromRelayUrls ${relayUrls}`,
				);
				relays.add(temporaryRelay);
			}
		}
		return new _NDKRelaySet(new Set(relays), ndk, pool);
	}
	async publish(event, timeoutMs, requiredRelayCount = 1) {
		const publishedToRelays = /* @__PURE__ */ new Set();
		const errors = /* @__PURE__ */ new Map();
		const isEphemeral2 = event.isEphemeral();
		event.publishStatus = "pending";
		const relayPublishedHandler = (relay) => {
			publishedToRelays.add(relay);
		};
		event.on("relay:published", relayPublishedHandler);
		try {
			const promises = Array.from(this.relays).map((relay) => {
				return new Promise((resolve) => {
					const timeoutId = timeoutMs
						? setTimeout(() => {
								if (!publishedToRelays.has(relay)) {
									errors.set(
										relay,
										new Error(`Publish timeout after ${timeoutMs}ms`),
									);
									resolve(false);
								}
							}, timeoutMs)
						: null;
					relay
						.publish(event, timeoutMs)
						.then((success) => {
							if (timeoutId) clearTimeout(timeoutId);
							if (success) {
								publishedToRelays.add(relay);
								resolve(true);
							} else {
								resolve(false);
							}
						})
						.catch((err) => {
							if (timeoutId) clearTimeout(timeoutId);
							if (!isEphemeral2) {
								errors.set(relay, err);
							}
							resolve(false);
						});
				});
			});
			await Promise.all(promises);
			if (publishedToRelays.size < requiredRelayCount) {
				if (!isEphemeral2) {
					const error = new NDKPublishError(
						"Not enough relays received the event (" +
							publishedToRelays.size +
							" published, " +
							requiredRelayCount +
							" required)",
						errors,
						publishedToRelays,
						this,
					);
					event.publishStatus = "error";
					event.publishError = error;
					this.ndk?.emit("event:publish-failed", event, error, this.relayUrls);
					throw error;
				}
			} else {
				event.publishStatus = "success";
				event.emit("published", { relaySet: this, publishedToRelays });
			}
			return publishedToRelays;
		} finally {
			event.off("relay:published", relayPublishedHandler);
		}
	}
	get size() {
		return this.relays.size;
	}
};
var d = import_debug.default("ndk:outbox:calculate");
async function calculateRelaySetFromEvent(ndk, event, requiredRelayCount) {
	const relays = /* @__PURE__ */ new Set();
	const authorWriteRelays = await getWriteRelaysFor(ndk, event.pubkey);
	if (authorWriteRelays) {
		authorWriteRelays.forEach((relayUrl) => {
			const relay = ndk.pool?.getRelay(relayUrl);
			if (relay) relays.add(relay);
		});
	}
	let relayHints = event.tags
		.filter((tag) => ["a", "e"].includes(tag[0]))
		.map((tag) => tag[2])
		.filter((url) => url?.startsWith("wss://"))
		.filter((url) => {
			try {
				new URL(url);
				return true;
			} catch {
				return false;
			}
		})
		.map((url) => normalizeRelayUrl(url));
	relayHints = Array.from(new Set(relayHints)).slice(0, 5);
	relayHints.forEach((relayUrl) => {
		const relay = ndk.pool?.getRelay(relayUrl, true, true);
		if (relay) {
			d("Adding relay hint %s", relayUrl);
			relays.add(relay);
		}
	});
	const pTags = event.getMatchingTags("p").map((tag) => tag[1]);
	if (pTags.length < 5) {
		const pTaggedRelays = Array.from(
			chooseRelayCombinationForPubkeys(ndk, pTags, "read", {
				preferredRelays: new Set(authorWriteRelays),
			}).keys(),
		);
		pTaggedRelays.forEach((relayUrl) => {
			const relay = ndk.pool?.getRelay(relayUrl, false, true);
			if (relay) {
				d("Adding p-tagged relay %s", relayUrl);
				relays.add(relay);
			}
		});
	} else {
		d("Too many p-tags to consider %d", pTags.length);
	}
	ndk.pool?.permanentAndConnectedRelays().forEach((relay) => relays.add(relay));
	if (requiredRelayCount && relays.size < requiredRelayCount) {
		const explicitRelays = ndk.explicitRelayUrls
			?.filter((url) => !Array.from(relays).some((r) => r.url === url))
			.slice(0, requiredRelayCount - relays.size);
		explicitRelays?.forEach((url) => {
			const relay = ndk.pool?.getRelay(url, false, true);
			if (relay) {
				d("Adding explicit relay %s", url);
				relays.add(relay);
			}
		});
	}
	return new NDKRelaySet(relays, ndk);
}
function calculateRelaySetsFromFilter(ndk, filters, pool) {
	const result = /* @__PURE__ */ new Map();
	const authors = /* @__PURE__ */ new Set();
	filters.forEach((filter) => {
		if (filter.authors) {
			filter.authors.forEach((author) => authors.add(author));
		}
	});
	if (authors.size > 0) {
		const authorToRelaysMap = getRelaysForFilterWithAuthors(
			ndk,
			Array.from(authors),
		);
		for (const relayUrl of authorToRelaysMap.keys()) {
			result.set(relayUrl, []);
		}
		for (const filter of filters) {
			if (filter.authors) {
				for (const [relayUrl, authors2] of authorToRelaysMap.entries()) {
					const authorFilterAndRelayPubkeyIntersection = filter.authors.filter(
						(author) => authors2.includes(author),
					);
					result.set(relayUrl, [
						...result.get(relayUrl),
						{
							...filter,
							authors: authorFilterAndRelayPubkeyIntersection,
						},
					]);
				}
			} else {
				for (const relayUrl of authorToRelaysMap.keys()) {
					result.set(relayUrl, [...result.get(relayUrl), filter]);
				}
			}
		}
	} else {
		if (ndk.explicitRelayUrls) {
			ndk.explicitRelayUrls.forEach((relayUrl) => {
				result.set(relayUrl, filters);
			});
		}
	}
	if (result.size === 0) {
		pool
			.permanentAndConnectedRelays()
			.slice(0, 5)
			.forEach((relay) => {
				result.set(relay.url, filters);
			});
	}
	return result;
}
function calculateRelaySetsFromFilters(ndk, filters, pool) {
	const a = calculateRelaySetsFromFilter(ndk, filters, pool);
	return a;
}
function mergeTags(tags1, tags2) {
	const tagMap = /* @__PURE__ */ new Map();
	const generateKey = (tag) => tag.join(",");
	const isContained = (smaller, larger) => {
		return smaller.every((value, index) => value === larger[index]);
	};
	const processTag = (tag) => {
		for (const [key, existingTag] of tagMap) {
			if (isContained(existingTag, tag) || isContained(tag, existingTag)) {
				if (tag.length >= existingTag.length) {
					tagMap.set(key, tag);
				}
				return;
			}
		}
		tagMap.set(generateKey(tag), tag);
	};
	tags1.concat(tags2).forEach(processTag);
	return Array.from(tagMap.values());
}
var hashtagRegex = /(?<=\s|^)(#[^\s!@#$%^&*()=+./,[{\]};:'"?><]+)/g;
function generateHashtags(content) {
	const hashtags = content.match(hashtagRegex);
	const tagIds = /* @__PURE__ */ new Set();
	const tag = /* @__PURE__ */ new Set();
	if (hashtags) {
		for (const hashtag of hashtags) {
			if (tagIds.has(hashtag.slice(1))) continue;
			tag.add(hashtag.slice(1));
			tagIds.add(hashtag.slice(1));
		}
	}
	return Array.from(tag);
}
async function generateContentTags(content, tags = []) {
	const tagRegex = /(@|nostr:)(npub|nprofile|note|nevent|naddr)[a-zA-Z0-9]+/g;
	const promises = [];
	const addTagIfNew = (t) => {
		if (!tags.find((t2) => ["q", t[0]].includes(t2[0]) && t2[1] === t[1])) {
			tags.push(t);
		}
	};
	content = content.replace(tagRegex, (tag) => {
		try {
			const entity = tag.split(/(@|nostr:)/)[2];
			const { type, data } = nip19_exports.decode(entity);
			let t;
			switch (type) {
				case "npub":
					t = ["p", data];
					break;
				case "nprofile":
					t = ["p", data.pubkey];
					break;
				case "note":
					promises.push(
						new Promise(async (resolve) => {
							addTagIfNew(["q", data, await maybeGetEventRelayUrl(entity)]);
							resolve();
						}),
					);
					break;
				case "nevent":
					promises.push(
						new Promise(async (resolve) => {
							const { id, author } = data;
							let { relays } = data;
							if (!relays || relays.length === 0) {
								relays = [await maybeGetEventRelayUrl(entity)];
							}
							addTagIfNew(["q", id, relays[0]]);
							if (author) addTagIfNew(["p", author]);
							resolve();
						}),
					);
					break;
				case "naddr":
					promises.push(
						new Promise(async (resolve) => {
							const id = [data.kind, data.pubkey, data.identifier].join(":");
							let relays = data.relays ?? [];
							if (relays.length === 0) {
								relays = [await maybeGetEventRelayUrl(entity)];
							}
							addTagIfNew(["q", id, relays[0]]);
							addTagIfNew(["p", data.pubkey]);
							resolve();
						}),
					);
					break;
				default:
					return tag;
			}
			if (t) addTagIfNew(t);
			return `nostr:${entity}`;
		} catch (_error) {
			return tag;
		}
	});
	await Promise.all(promises);
	const newTags = generateHashtags(content).map((hashtag) => ["t", hashtag]);
	tags = mergeTags(tags, newTags);
	return { content, tags };
}
async function maybeGetEventRelayUrl(_nip19Id) {
	return "";
}
async function encrypt3(recipient, signer, scheme = "nip44") {
	let encrypted;
	if (!this.ndk) throw new Error("No NDK instance found!");
	let currentSigner = signer;
	if (!currentSigner) {
		this.ndk.assertSigner();
		currentSigner = this.ndk.signer;
	}
	if (!currentSigner) throw new Error("no NDK signer");
	const currentRecipient =
		recipient ||
		(() => {
			const pTags = this.getMatchingTags("p");
			if (pTags.length !== 1) {
				throw new Error(
					"No recipient could be determined and no explicit recipient was provided",
				);
			}
			return this.ndk.getUser({ pubkey: pTags[0][1] });
		})();
	if (
		scheme === "nip44" &&
		(await isEncryptionEnabled(currentSigner, "nip44"))
	) {
		encrypted = await currentSigner.encrypt(
			currentRecipient,
			this.content,
			"nip44",
		);
	}
	if (
		(!encrypted || scheme === "nip04") &&
		(await isEncryptionEnabled(currentSigner, "nip04"))
	) {
		encrypted = await currentSigner.encrypt(
			currentRecipient,
			this.content,
			"nip04",
		);
	}
	if (!encrypted) throw new Error("Failed to encrypt event.");
	this.content = encrypted;
}
async function decrypt3(sender, signer, scheme) {
	if (this.ndk?.cacheAdapter?.getDecryptedEvent) {
		let cachedEvent = null;
		if (typeof this.ndk.cacheAdapter.getDecryptedEvent === "function") {
			cachedEvent = this.ndk.cacheAdapter.getDecryptedEvent(this.id);
		}
		if (cachedEvent) {
			this.content = cachedEvent.content;
			return;
		}
	}
	let decrypted;
	if (!this.ndk) throw new Error("No NDK instance found!");
	let currentSigner = signer;
	if (!currentSigner) {
		this.ndk.assertSigner();
		currentSigner = this.ndk.signer;
	}
	if (!currentSigner) throw new Error("no NDK signer");
	const currentSender = sender || this.author;
	if (!currentSender)
		throw new Error("No sender provided and no author available");
	const currentScheme =
		scheme || (this.content.match(/\\?iv=/) ? "nip04" : "nip44");
	if (
		(currentScheme === "nip04" || this.kind === 4) &&
		(await isEncryptionEnabled(currentSigner, "nip04")) &&
		this.content.search("\\?iv=")
	) {
		decrypted = await currentSigner.decrypt(
			currentSender,
			this.content,
			"nip04",
		);
	}
	if (
		!decrypted &&
		currentScheme === "nip44" &&
		(await isEncryptionEnabled(currentSigner, "nip44"))
	) {
		decrypted = await currentSigner.decrypt(
			currentSender,
			this.content,
			"nip44",
		);
	}
	if (!decrypted) throw new Error("Failed to decrypt event.");
	this.content = decrypted;
	if (this.ndk?.cacheAdapter?.addDecryptedEvent) {
		this.ndk.cacheAdapter.addDecryptedEvent(this);
	}
}
async function isEncryptionEnabled(signer, scheme) {
	if (!signer.encryptionEnabled) return false;
	if (!scheme) return true;
	return Boolean(await signer.encryptionEnabled(scheme));
}
function eventHasETagMarkers(event) {
	for (const tag of event.tags) {
		if (tag[0] === "e" && (tag[3] ?? "").length > 0) return true;
	}
	return false;
}
function getRootTag(event, searchTag) {
	searchTag ??= event.tagType();
	const rootEventTag = event.tags.find(isTagRootTag);
	if (!rootEventTag) {
		if (eventHasETagMarkers(event)) return;
		const matchingTags = event.getMatchingTags(searchTag);
		if (matchingTags.length < 3) return matchingTags[0];
	}
	return rootEventTag;
}
var nip22RootTags = /* @__PURE__ */ new Set(["A", "E", "I"]);
var nip22ReplyTags = /* @__PURE__ */ new Set(["a", "e", "i"]);
function getReplyTag(event, searchTag) {
	if (event.kind === 1111) {
		let replyTag2;
		for (const tag of event.tags) {
			if (nip22RootTags.has(tag[0])) replyTag2 = tag;
			else if (nip22ReplyTags.has(tag[0])) {
				replyTag2 = tag;
				break;
			}
		}
		return replyTag2;
	}
	searchTag ??= event.tagType();
	let hasMarkers2 = false;
	let replyTag;
	for (const tag of event.tags) {
		if (tag[0] !== searchTag) continue;
		if ((tag[3] ?? "").length > 0) hasMarkers2 = true;
		if (hasMarkers2 && tag[3] === "reply") return tag;
		if (hasMarkers2 && tag[3] === "root") replyTag = tag;
		if (!hasMarkers2) replyTag = tag;
	}
	return replyTag;
}
function isTagRootTag(tag) {
	return tag[0] === "E" || tag[3] === "root";
}
async function fetchTaggedEvent(tag, marker) {
	if (!this.ndk) throw new Error("NDK instance not found");
	const t = this.getMatchingTags(tag, marker);
	if (t.length === 0) return;
	const [_, id, hint] = t[0];
	const relay = hint !== "" ? this.ndk.pool.getRelay(hint) : undefined;
	const event = await this.ndk.fetchEvent(id, {}, relay);
	return event;
}
async function fetchRootEvent(subOpts) {
	if (!this.ndk) throw new Error("NDK instance not found");
	const rootTag = getRootTag(this);
	if (!rootTag) return;
	return this.ndk.fetchEventFromTag(rootTag, this, subOpts);
}
async function fetchReplyEvent(subOpts) {
	if (!this.ndk) throw new Error("NDK instance not found");
	const replyTag = getReplyTag(this);
	if (!replyTag) return;
	return this.ndk.fetchEventFromTag(replyTag, this, subOpts);
}
function isReplaceable() {
	if (this.kind === undefined) throw new Error("Kind not set");
	return (
		[0, 3].includes(this.kind) ||
		(this.kind >= 1e4 && this.kind < 20000) ||
		(this.kind >= 30000 && this.kind < 40000)
	);
}
function isEphemeral() {
	if (this.kind === undefined) throw new Error("Kind not set");
	return this.kind >= 20000 && this.kind < 30000;
}
function isParamReplaceable() {
	if (this.kind === undefined) throw new Error("Kind not set");
	return this.kind >= 30000 && this.kind < 40000;
}
var DEFAULT_RELAY_COUNT = 2;
function encode(maxRelayCount = DEFAULT_RELAY_COUNT) {
	let relays = [];
	if (this.onRelays.length > 0) {
		relays = this.onRelays.map((relay) => relay.url);
	} else if (this.relay) {
		relays = [this.relay.url];
	}
	if (relays.length > maxRelayCount) {
		relays = relays.slice(0, maxRelayCount);
	}
	if (this.isParamReplaceable()) {
		return nip19_exports.naddrEncode({
			kind: this.kind,
			pubkey: this.pubkey,
			identifier: this.replaceableDTag(),
			relays,
		});
	}
	if (relays.length > 0) {
		return nip19_exports.neventEncode({
			id: this.tagId(),
			relays,
			author: this.pubkey,
		});
	}
	return nip19_exports.noteEncode(this.tagId());
}
async function repost(publish = true, signer) {
	if (!signer && publish) {
		if (!this.ndk) throw new Error("No NDK instance found");
		this.ndk.assertSigner();
		signer = this.ndk.signer;
	}
	const e = new NDKEvent(this.ndk, {
		kind: getKind(this),
	});
	if (!this.isProtected) e.content = JSON.stringify(this.rawEvent());
	e.tag(this);
	if (this.kind !== 1) {
		e.tags.push(["k", `${this.kind}`]);
	}
	if (signer) await e.sign(signer);
	if (publish) await e.publish();
	return e;
}
function getKind(event) {
	if (event.kind === 1) {
		return 6;
	}
	return 16;
}
function serialize(includeSig = false, includeId = false) {
	const payload = [
		0,
		this.pubkey,
		this.created_at,
		this.kind,
		this.tags,
		this.content,
	];
	if (includeSig) payload.push(this.sig);
	if (includeId) payload.push(this.id);
	return JSON.stringify(payload);
}
function deserialize(serializedEvent) {
	const eventArray = JSON.parse(serializedEvent);
	const ret = {
		pubkey: eventArray[1],
		created_at: eventArray[2],
		kind: eventArray[3],
		tags: eventArray[4],
		content: eventArray[5],
	};
	if (eventArray.length >= 7) {
		const first = eventArray[6];
		const second = eventArray[7];
		if (first && first.length === 128) {
			ret.sig = first;
			if (second && second.length === 64) {
				ret.id = second;
			}
		} else if (first && first.length === 64) {
			ret.id = first;
			if (second && second.length === 128) {
				ret.sig = second;
			}
		}
	}
	return ret;
}
var worker;
var processingQueue = {};
function signatureVerificationInit(w) {
	worker = w;
	worker.onmessage = (msg) => {
		const [eventId, result] = msg.data;
		const record = processingQueue[eventId];
		if (!record) {
			console.error("No record found for event", eventId);
			return;
		}
		delete processingQueue[eventId];
		for (const resolve of record.resolves) {
			resolve(result);
		}
	};
}
async function verifySignatureAsync(event, _persist, relay) {
	const ndkInstance = event.ndk;
	const start = Date.now();
	let result;
	if (ndkInstance.signatureVerificationFunction) {
		console.log(
			"[NDK-CORE] Using custom signature verification function async",
		);
		result = await ndkInstance.signatureVerificationFunction(event);
		console.log("Custom signature verification result", event.id, { result });
	} else {
		console.log("Using worker-based signature verification async");
		result = await new Promise((resolve) => {
			const serialized = event.serialize();
			let enqueue = false;
			if (!processingQueue[event.id]) {
				processingQueue[event.id] = { event, resolves: [], relay };
				enqueue = true;
			}
			processingQueue[event.id].resolves.push(resolve);
			if (!enqueue) return;
			worker?.postMessage({
				serialized,
				id: event.id,
				sig: event.sig,
				pubkey: event.pubkey,
			});
		});
	}
	ndkInstance.signatureVerificationTimeMs += Date.now() - start;
	return result;
}
var PUBKEY_REGEX = /^[a-f0-9]{64}$/;
function validate() {
	if (typeof this.kind !== "number") return false;
	if (typeof this.content !== "string") return false;
	if (typeof this.created_at !== "number") return false;
	if (typeof this.pubkey !== "string") return false;
	if (!this.pubkey.match(PUBKEY_REGEX)) return false;
	if (!Array.isArray(this.tags)) return false;
	for (let i2 = 0; i2 < this.tags.length; i2++) {
		const tag = this.tags[i2];
		if (!Array.isArray(tag)) return false;
		for (let j = 0; j < tag.length; j++) {
			if (typeof tag[j] === "object") return false;
		}
	}
	return true;
}
var verifiedSignatures = new import_typescript_lru_cache.LRUCache({
	maxSize: 1000,
	entryExpirationTimeInMS: 60000,
});
function verifySignature(persist) {
	if (typeof this.signatureVerified === "boolean")
		return this.signatureVerified;
	const prevVerification = verifiedSignatures.get(this.id);
	if (prevVerification !== null) {
		this.signatureVerified = !!prevVerification;
		return this.signatureVerified;
	}
	try {
		if (this.ndk?.asyncSigVerification) {
			verifySignatureAsync(this, persist, this.relay)
				.then((result) => {
					if (persist) {
						this.signatureVerified = result;
						if (result) verifiedSignatures.set(this.id, this.sig);
					}
					if (!result) {
						if (this.relay) {
							this.ndk?.reportInvalidSignature(this, this.relay);
						} else {
							this.ndk?.reportInvalidSignature(this);
						}
						verifiedSignatures.set(this.id, false);
					}
				})
				.catch((err) => {
					console.error("signature verification error", this.id, err);
				});
		} else {
			const hash3 = sha2564(new TextEncoder().encode(this.serialize()));
			const res = schnorr2.verify(this.sig, hash3, this.pubkey);
			if (res) verifiedSignatures.set(this.id, this.sig);
			else verifiedSignatures.set(this.id, false);
			this.signatureVerified = res;
			return res;
		}
	} catch (_err) {
		this.signatureVerified = false;
		return false;
	}
}
function getEventHash2() {
	return getEventHashFromSerializedEvent(this.serialize());
}
function getEventHashFromSerializedEvent(serializedEvent) {
	const eventHash = sha2564(new TextEncoder().encode(serializedEvent));
	return bytesToHex3(eventHash);
}
var skipClientTagOnKinds = /* @__PURE__ */ new Set([
	0, 4, 1059, 13, 3, 9734, 5,
]);
var NDKEvent = class _NDKEvent extends import_tseep.EventEmitter {
	ndk;
	created_at;
	content = "";
	tags = [];
	kind;
	id = "";
	sig;
	pubkey = "";
	signatureVerified;
	_author = undefined;
	relay;
	get onRelays() {
		let res = [];
		if (!this.ndk) {
			if (this.relay) res.push(this.relay);
		} else {
			res = this.ndk.subManager.seenEvents.get(this.id) || [];
		}
		return res;
	}
	publishStatus = "success";
	publishError;
	constructor(ndk, event) {
		super();
		this.ndk = ndk;
		this.created_at = event?.created_at;
		this.content = event?.content || "";
		this.tags = event?.tags || [];
		this.id = event?.id || "";
		this.sig = event?.sig;
		this.pubkey = event?.pubkey || "";
		this.kind = event?.kind;
		if (event instanceof _NDKEvent) {
			if (this.relay) {
				this.relay = event.relay;
				this.ndk?.subManager.seenEvent(event.id, this.relay);
			}
			this.publishStatus = event.publishStatus;
			this.publishError = event.publishError;
		}
	}
	static deserialize(ndk, event) {
		return new _NDKEvent(ndk, deserialize(event));
	}
	rawEvent() {
		return {
			created_at: this.created_at,
			content: this.content,
			tags: this.tags,
			kind: this.kind,
			pubkey: this.pubkey,
			id: this.id,
			sig: this.sig,
		};
	}
	set author(user) {
		this.pubkey = user.pubkey;
		this._author = user;
		this._author.ndk ??= this.ndk;
	}
	get author() {
		if (this._author) return this._author;
		if (!this.ndk) throw new Error("No NDK instance found");
		const user = this.ndk.getUser({ pubkey: this.pubkey });
		this._author = user;
		return user;
	}
	tagExternal(entity, type, markerUrl) {
		const iTag = ["i"];
		const kTag = ["k"];
		switch (type) {
			case "url": {
				const url = new URL(entity);
				url.hash = "";
				iTag.push(url.toString());
				kTag.push(`${url.protocol}//${url.host}`);
				break;
			}
			case "hashtag":
				iTag.push(`#${entity.toLowerCase()}`);
				kTag.push("#");
				break;
			case "geohash":
				iTag.push(`geo:${entity.toLowerCase()}`);
				kTag.push("geo");
				break;
			case "isbn":
				iTag.push(`isbn:${entity.replace(/-/g, "")}`);
				kTag.push("isbn");
				break;
			case "podcast:guid":
				iTag.push(`podcast:guid:${entity}`);
				kTag.push("podcast:guid");
				break;
			case "podcast:item:guid":
				iTag.push(`podcast:item:guid:${entity}`);
				kTag.push("podcast:item:guid");
				break;
			case "podcast:publisher:guid":
				iTag.push(`podcast:publisher:guid:${entity}`);
				kTag.push("podcast:publisher:guid");
				break;
			case "isan":
				iTag.push(`isan:${entity.split("-").slice(0, 4).join("-")}`);
				kTag.push("isan");
				break;
			case "doi":
				iTag.push(`doi:${entity.toLowerCase()}`);
				kTag.push("doi");
				break;
			default:
				throw new Error(`Unsupported NIP-73 entity type: ${type}`);
		}
		if (markerUrl) {
			iTag.push(markerUrl);
		}
		this.tags.push(iTag);
		this.tags.push(kTag);
	}
	tag(target, marker, skipAuthorTag, forceTag) {
		let tags = [];
		const isNDKUser = target.fetchProfile !== undefined;
		if (isNDKUser) {
			forceTag ??= "p";
			const tag = [forceTag, target.pubkey];
			if (marker) tag.push(...["", marker]);
			tags.push(tag);
		} else if (target instanceof _NDKEvent) {
			const event = target;
			skipAuthorTag ??= event?.pubkey === this.pubkey;
			tags = event.referenceTags(marker, skipAuthorTag, forceTag);
			for (const pTag of event.getMatchingTags("p")) {
				if (pTag[1] === this.pubkey) continue;
				if (this.tags.find((t) => t[0] === "p" && t[1] === pTag[1])) continue;
				this.tags.push(["p", pTag[1]]);
			}
		} else if (Array.isArray(target)) {
			tags = [target];
		} else {
			throw new Error("Invalid argument", target);
		}
		this.tags = mergeTags(this.tags, tags);
	}
	async toNostrEvent(pubkey) {
		if (!pubkey && this.pubkey === "") {
			const user = await this.ndk?.signer?.user();
			this.pubkey = user?.pubkey || "";
		}
		if (!this.created_at) {
			this.created_at = Math.floor(Date.now() / 1000);
		}
		const { content, tags } = await this.generateTags();
		this.content = content || "";
		this.tags = tags;
		try {
			this.id = this.getEventHash();
		} catch (_e) {}
		return this.rawEvent();
	}
	serialize = serialize.bind(this);
	getEventHash = getEventHash2.bind(this);
	validate = validate.bind(this);
	verifySignature = verifySignature.bind(this);
	isReplaceable = isReplaceable.bind(this);
	isEphemeral = isEphemeral.bind(this);
	isDvm = () => this.kind && this.kind >= 5000 && this.kind <= 7000;
	isParamReplaceable = isParamReplaceable.bind(this);
	encode = encode.bind(this);
	encrypt = encrypt3.bind(this);
	decrypt = decrypt3.bind(this);
	getMatchingTags(tagName, marker) {
		const t = this.tags.filter((tag) => tag[0] === tagName);
		if (marker === undefined) return t;
		return t.filter((tag) => tag[3] === marker);
	}
	hasTag(tagName, marker) {
		return this.tags.some(
			(tag) => tag[0] === tagName && (!marker || tag[3] === marker),
		);
	}
	tagValue(tagName, marker) {
		const tags = this.getMatchingTags(tagName, marker);
		if (tags.length === 0) return;
		return tags[0][1];
	}
	get alt() {
		return this.tagValue("alt");
	}
	set alt(alt) {
		this.removeTag("alt");
		if (alt) this.tags.push(["alt", alt]);
	}
	get dTag() {
		return this.tagValue("d");
	}
	set dTag(value) {
		this.removeTag("d");
		if (value) this.tags.push(["d", value]);
	}
	removeTag(tagName, marker) {
		const tagNames = Array.isArray(tagName) ? tagName : [tagName];
		this.tags = this.tags.filter((tag) => {
			const include = tagNames.includes(tag[0]);
			const hasMarker = marker ? tag[3] === marker : true;
			return !(include && hasMarker);
		});
	}
	replaceTag(tag) {
		this.removeTag(tag[0]);
		this.tags.push(tag);
	}
	async sign(signer) {
		if (!signer) {
			this.ndk?.assertSigner();
			signer = this.ndk?.signer;
		} else {
			this.author = await signer.user();
		}
		const nostrEvent = await this.toNostrEvent();
		this.sig = await signer.sign(nostrEvent);
		return this.sig;
	}
	async publishReplaceable(relaySet, timeoutMs, requiredRelayCount) {
		this.id = "";
		this.created_at = Math.floor(Date.now() / 1000);
		this.sig = "";
		return this.publish(relaySet, timeoutMs, requiredRelayCount);
	}
	async publish(relaySet, timeoutMs, requiredRelayCount) {
		if (!requiredRelayCount) requiredRelayCount = 1;
		if (!this.sig) await this.sign();
		if (!this.ndk)
			throw new Error(
				"NDKEvent must be associated with an NDK instance to publish",
			);
		if (!relaySet || relaySet.size === 0) {
			relaySet =
				this.ndk.devWriteRelaySet ||
				(await calculateRelaySetFromEvent(this.ndk, this, requiredRelayCount));
		}
		if (this.kind === 5 && this.ndk.cacheAdapter?.deleteEventIds) {
			const eTags = this.getMatchingTags("e").map((tag) => tag[1]);
			this.ndk.cacheAdapter.deleteEventIds(eTags);
		}
		const rawEvent = this.rawEvent();
		if (
			this.ndk.cacheAdapter?.addUnpublishedEvent &&
			shouldTrackUnpublishedEvent(this)
		) {
			try {
				this.ndk.cacheAdapter.addUnpublishedEvent(this, relaySet.relayUrls);
			} catch (e) {
				console.error("Error adding unpublished event to cache", e);
			}
		}
		if (this.kind === 5 && this.ndk.cacheAdapter?.deleteEventIds) {
			this.ndk.cacheAdapter.deleteEventIds(
				this.getMatchingTags("e").map((tag) => tag[1]),
			);
		}
		this.ndk.subManager.dispatchEvent(rawEvent, undefined, true);
		const relays = await relaySet.publish(this, timeoutMs, requiredRelayCount);
		relays.forEach((relay) => this.ndk?.subManager.seenEvent(this.id, relay));
		return relays;
	}
	async generateTags() {
		let tags = [];
		const g = await generateContentTags(this.content, this.tags);
		const content = g.content;
		tags = g.tags;
		if (this.kind && this.isParamReplaceable()) {
			const dTag = this.getMatchingTags("d")[0];
			if (!dTag) {
				const title = this.tagValue("title");
				const randLength = title ? 6 : 16;
				let str = [...Array(randLength)]
					.map(() => Math.random().toString(36)[2])
					.join("");
				if (title && title.length > 0) {
					str = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${str}`;
				}
				tags.push(["d", str]);
			}
		}
		if (this.shouldAddClientTag) {
			const clientTag = ["client", this.ndk?.clientName ?? ""];
			if (this.ndk?.clientNip89) clientTag.push(this.ndk?.clientNip89);
			tags.push(clientTag);
		} else if (this.shouldStripClientTag) {
			tags = tags.filter((tag) => tag[0] !== "client");
		}
		return { content: content || "", tags };
	}
	get shouldAddClientTag() {
		if (!this.ndk?.clientName && !this.ndk?.clientNip89) return false;
		if (skipClientTagOnKinds.has(this.kind)) return false;
		if (this.isEphemeral()) return false;
		if (this.isReplaceable() && !this.isParamReplaceable()) return false;
		if (this.isDvm()) return false;
		if (this.hasTag("client")) return false;
		return true;
	}
	get shouldStripClientTag() {
		return skipClientTagOnKinds.has(this.kind);
	}
	muted() {
		const authorMutedEntry = this.ndk?.mutedIds.get(this.pubkey);
		if (authorMutedEntry && authorMutedEntry === "p") return "author";
		const eventTagReference = this.tagReference();
		const eventMutedEntry = this.ndk?.mutedIds.get(eventTagReference[1]);
		if (eventMutedEntry && eventMutedEntry === eventTagReference[0])
			return "event";
		return null;
	}
	replaceableDTag() {
		if (this.kind && this.kind >= 30000 && this.kind <= 40000) {
			const dTag = this.getMatchingTags("d")[0];
			const dTagId = dTag ? dTag[1] : "";
			return dTagId;
		}
		throw new Error("Event is not a parameterized replaceable event");
	}
	deduplicationKey() {
		if (
			this.kind === 0 ||
			this.kind === 3 ||
			(this.kind && this.kind >= 1e4 && this.kind < 20000)
		) {
			return `${this.kind}:${this.pubkey}`;
		}
		return this.tagId();
	}
	tagId() {
		if (this.isParamReplaceable()) {
			return this.tagAddress();
		}
		return this.id;
	}
	tagAddress() {
		if (this.isParamReplaceable()) {
			const dTagId = this.dTag ?? "";
			return `${this.kind}:${this.pubkey}:${dTagId}`;
		}
		if (this.isReplaceable()) {
			return `${this.kind}:${this.pubkey}:`;
		}
		throw new Error("Event is not a replaceable event");
	}
	tagType() {
		return this.isParamReplaceable() ? "a" : "e";
	}
	tagReference(marker) {
		let tag;
		if (this.isParamReplaceable()) {
			tag = ["a", this.tagAddress()];
		} else {
			tag = ["e", this.tagId()];
		}
		if (this.relay) {
			tag.push(this.relay.url);
		} else {
			tag.push("");
		}
		tag.push(marker ?? "");
		if (!this.isParamReplaceable()) {
			tag.push(this.pubkey);
		}
		return tag;
	}
	referenceTags(marker, skipAuthorTag, forceTag) {
		let tags = [];
		if (this.isParamReplaceable()) {
			tags = [
				[forceTag ?? "a", this.tagAddress()],
				[forceTag ?? "e", this.id],
			];
		} else {
			tags = [[forceTag ?? "e", this.id]];
		}
		tags = tags.map((tag) => {
			if (tag[0] === "e" || marker) {
				tag.push(this.relay?.url ?? "");
			} else if (this.relay?.url) {
				tag.push(this.relay?.url);
			}
			return tag;
		});
		tags.forEach((tag) => {
			if (tag[0] === "e") {
				tag.push(marker ?? "");
				tag.push(this.pubkey);
			} else if (marker) {
				tag.push(marker);
			}
		});
		tags = [...tags, ...this.getMatchingTags("h")];
		if (!skipAuthorTag) tags.push(...this.author.referenceTags());
		return tags;
	}
	filter() {
		if (this.isParamReplaceable()) {
			return { "#a": [this.tagId()] };
		}
		return { "#e": [this.tagId()] };
	}
	nip22Filter() {
		if (this.isParamReplaceable()) {
			return { "#A": [this.tagId()] };
		}
		return { "#E": [this.tagId()] };
	}
	async delete(reason, publish = true) {
		if (!this.ndk) throw new Error("No NDK instance found");
		this.ndk.assertSigner();
		const e = new _NDKEvent(this.ndk, {
			kind: 5,
			content: reason || "",
		});
		e.tag(this, undefined, true);
		e.tags.push(["k", this.kind?.toString()]);
		if (publish) {
			this.emit("deleted");
			await e.publish();
		}
		return e;
	}
	set isProtected(val) {
		this.removeTag("-");
		if (val) this.tags.push(["-"]);
	}
	get isProtected() {
		return this.hasTag("-");
	}
	fetchTaggedEvent = fetchTaggedEvent.bind(this);
	fetchRootEvent = fetchRootEvent.bind(this);
	fetchReplyEvent = fetchReplyEvent.bind(this);
	repost = repost.bind(this);
	async react(content, publish = true) {
		if (!this.ndk) throw new Error("No NDK instance found");
		this.ndk.assertSigner();
		const e = new _NDKEvent(this.ndk, {
			kind: 7,
			content,
		});
		e.tag(this);
		if (this.kind !== 1) {
			e.tags.push(["k", `${this.kind}`]);
		}
		if (publish) await e.publish();
		return e;
	}
	get isValid() {
		return this.validate();
	}
	get inspect() {
		return JSON.stringify(this.rawEvent(), null, 4);
	}
	dump() {
		console.debug(JSON.stringify(this.rawEvent(), null, 4));
		console.debug(
			"Event on relays:",
			this.onRelays.map((relay) => relay.url).join(", "),
		);
	}
	reply(forceNip22) {
		const reply = new _NDKEvent(this.ndk);
		if (this.kind === 1 && !forceNip22) {
			reply.kind = 1;
			const opHasETag = this.hasTag("e");
			if (opHasETag) {
				reply.tags = [
					...reply.tags,
					...this.getMatchingTags("e"),
					...this.getMatchingTags("p"),
					...this.getMatchingTags("a"),
					...this.referenceTags("reply"),
				];
			} else {
				reply.tag(this, "root");
			}
		} else {
			reply.kind = 1111;
			const carryOverTags = ["A", "E", "I", "P"];
			const rootTags = this.tags.filter((tag) =>
				carryOverTags.includes(tag[0]),
			);
			if (rootTags.length > 0) {
				const rootKind = this.tagValue("K");
				reply.tags.push(...rootTags);
				if (rootKind) reply.tags.push(["K", rootKind]);
				const [type, id, _, ...extra] = this.tagReference();
				const tag = [type, id, ...extra];
				reply.tags.push(tag);
			} else {
				const [type, id, _, relayHint] = this.tagReference();
				const tag = [type, id, relayHint ?? ""];
				if (type === "e") tag.push(this.pubkey);
				reply.tags.push(tag);
				const uppercaseTag = [...tag];
				uppercaseTag[0] = uppercaseTag[0].toUpperCase();
				reply.tags.push(uppercaseTag);
				reply.tags.push(["K", this.kind?.toString()]);
				reply.tags.push(["P", this.pubkey]);
			}
			reply.tags.push(["k", this.kind?.toString()]);
			reply.tags.push(...this.getMatchingTags("p"));
			reply.tags.push(["p", this.pubkey]);
		}
		return reply;
	}
};
var untrackedUnpublishedEvents = /* @__PURE__ */ new Set([
	24133, 13194, 23194, 23195,
]);
function shouldTrackUnpublishedEvent(event) {
	return !untrackedUnpublishedEvents.has(event.kind);
}
var NDKPool = class extends import_tseep3.EventEmitter {
	_relays = /* @__PURE__ */ new Map();
	status = "idle";
	autoConnectRelays = /* @__PURE__ */ new Set();
	poolBlacklistRelayUrls = /* @__PURE__ */ new Set();
	debug;
	temporaryRelayTimers = /* @__PURE__ */ new Map();
	flappingRelays = /* @__PURE__ */ new Set();
	backoffTimes = /* @__PURE__ */ new Map();
	ndk;
	get blacklistRelayUrls() {
		const val = new Set(this.ndk.blacklistRelayUrls);
		this.poolBlacklistRelayUrls.forEach((url) => val.add(url));
		return val;
	}
	constructor(
		relayUrls,
		blacklistedRelayUrls,
		ndk,
		{ debug: debug9, name } = {},
	) {
		super();
		this.debug = debug9 ?? ndk.debug.extend("pool");
		if (name) this._name = name;
		this.ndk = ndk;
		this.relayUrls = relayUrls;
		this.poolBlacklistRelayUrls = new Set(blacklistedRelayUrls);
		this.ndk.pools.push(this);
	}
	get relays() {
		return this._relays;
	}
	set relayUrls(urls) {
		this._relays.clear();
		for (const relayUrl of urls) {
			const relay = new NDKRelay(relayUrl, undefined, this.ndk);
			relay.connectivity.netDebug = this.ndk.netDebug;
			this.addRelay(relay);
		}
	}
	_name = "unnamed";
	get name() {
		return this._name;
	}
	set name(name) {
		this._name = name;
		this.debug = this.debug.extend(name);
	}
	useTemporaryRelay(relay, removeIfUnusedAfter = 30000, filters) {
		const relayAlreadyInPool = this.relays.has(relay.url);
		if (!relayAlreadyInPool) {
			this.addRelay(relay);
			this.debug(
				"Adding temporary relay %s for filters %o",
				relay.url,
				filters,
			);
		}
		const existingTimer = this.temporaryRelayTimers.get(relay.url);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}
		if (!relayAlreadyInPool || existingTimer) {
			const timer = setTimeout(() => {
				if (this.ndk.explicitRelayUrls?.includes(relay.url)) return;
				this.removeRelay(relay.url);
			}, removeIfUnusedAfter);
			this.temporaryRelayTimers.set(relay.url, timer);
		}
	}
	addRelay(relay, connect = true) {
		const isAlreadyInPool = this.relays.has(relay.url);
		const isBlacklisted = this.blacklistRelayUrls?.has(relay.url);
		const isCustomRelayUrl = relay.url.includes("/npub1");
		let reconnect = true;
		const relayUrl = relay.url;
		if (isAlreadyInPool) return;
		if (isBlacklisted) {
			this.debug(`Refusing to add relay ${relayUrl}: blacklisted`);
			return;
		}
		if (isCustomRelayUrl) {
			this.debug(`Refusing to add relay ${relayUrl}: is a filter relay`);
			return;
		}
		if (this.ndk.cacheAdapter?.getRelayStatus) {
			const info = this.ndk.cacheAdapter.getRelayStatus(relayUrl);
			if (info?.dontConnectBefore) {
				if (info.dontConnectBefore > Date.now()) {
					const delay = info.dontConnectBefore - Date.now();
					this.debug(
						`Refusing to add relay ${relayUrl}: delayed connect for ${delay}ms`,
					);
					setTimeout(() => {
						this.addRelay(relay, connect);
					}, delay);
					return;
				}
				reconnect = false;
			}
		}
		const noticeHandler = (notice) => this.emit("notice", relay, notice);
		const connectHandler = () => this.handleRelayConnect(relayUrl);
		const readyHandler = () => this.handleRelayReady(relay);
		const disconnectHandler = () => this.emit("relay:disconnect", relay);
		const flappingHandler = () => this.handleFlapping(relay);
		const authHandler = (challenge3) =>
			this.emit("relay:auth", relay, challenge3);
		const authedHandler = () => this.emit("relay:authed", relay);
		relay.off("notice", noticeHandler);
		relay.off("connect", connectHandler);
		relay.off("ready", readyHandler);
		relay.off("disconnect", disconnectHandler);
		relay.off("flapping", flappingHandler);
		relay.off("auth", authHandler);
		relay.off("authed", authedHandler);
		relay.on("notice", noticeHandler);
		relay.on("connect", connectHandler);
		relay.on("ready", readyHandler);
		relay.on("disconnect", disconnectHandler);
		relay.on("flapping", flappingHandler);
		relay.on("auth", authHandler);
		relay.on("authed", authedHandler);
		relay.on("delayed-connect", (delay) => {
			if (this.ndk.cacheAdapter?.updateRelayStatus) {
				this.ndk.cacheAdapter.updateRelayStatus(relay.url, {
					dontConnectBefore: Date.now() + delay,
				});
			}
		});
		this._relays.set(relayUrl, relay);
		if (connect) this.autoConnectRelays.add(relayUrl);
		if (connect && this.status === "active") {
			this.emit("relay:connecting", relay);
			relay.connect(undefined, reconnect).catch((e) => {
				this.debug(`Failed to connect to relay ${relayUrl}`, e);
			});
		}
	}
	removeRelay(relayUrl) {
		const relay = this.relays.get(relayUrl);
		if (relay) {
			relay.disconnect();
			this.relays.delete(relayUrl);
			this.autoConnectRelays.delete(relayUrl);
			this.emit("relay:disconnect", relay);
			return true;
		}
		const existingTimer = this.temporaryRelayTimers.get(relayUrl);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.temporaryRelayTimers.delete(relayUrl);
		}
		return false;
	}
	isRelayConnected(url) {
		const normalizedUrl = normalizeRelayUrl(url);
		const relay = this.relays.get(normalizedUrl);
		if (!relay) return false;
		return relay.status === 5;
	}
	getRelay(url, connect = true, temporary = false, filters) {
		let relay = this.relays.get(normalizeRelayUrl(url));
		if (!relay) {
			relay = new NDKRelay(url, undefined, this.ndk);
			relay.connectivity.netDebug = this.ndk.netDebug;
			if (temporary) {
				this.useTemporaryRelay(relay, 30000, filters);
			} else {
				this.addRelay(relay, connect);
			}
		}
		return relay;
	}
	handleRelayConnect(relayUrl) {
		const relay = this.relays.get(relayUrl);
		if (!relay) {
			console.error("NDK BUG: relay not found in pool", { relayUrl });
			return;
		}
		this.emit("relay:connect", relay);
		if (this.stats().connected === this.relays.size) {
			this.emit("connect");
		}
	}
	handleRelayReady(relay) {
		this.emit("relay:ready", relay);
	}
	async connect(timeoutMs) {
		this.status = "active";
		this.debug(
			`Connecting to ${this.relays.size} relays${timeoutMs ? `, timeout ${timeoutMs}ms` : ""}...`,
		);
		const relaysToConnect = Array.from(this.autoConnectRelays.keys())
			.map((url) => this.relays.get(url))
			.filter((relay) => !!relay);
		for (const relay of relaysToConnect) {
			if (relay.status !== 5 && relay.status !== 4) {
				this.emit("relay:connecting", relay);
				relay.connect().catch((e) => {
					this.debug(
						`Failed to connect to relay ${relay.url}: ${e ?? "No reason specified"}`,
					);
				});
			}
		}
		const allConnected = () => relaysToConnect.every((r) => r.status === 5);
		const allConnectedPromise = new Promise((resolve) => {
			if (allConnected()) {
				resolve();
				return;
			}
			const listeners = [];
			for (const relay of relaysToConnect) {
				const handler = () => {
					if (allConnected()) {
						for (let i2 = 0; i2 < relaysToConnect.length; i2++) {
							relaysToConnect[i2].off("connect", listeners[i2]);
						}
						resolve();
					}
				};
				listeners.push(handler);
				relay.on("connect", handler);
			}
		});
		const timeoutPromise =
			typeof timeoutMs === "number"
				? new Promise((resolve) => setTimeout(resolve, timeoutMs))
				: new Promise(() => {});
		await Promise.race([allConnectedPromise, timeoutPromise]);
	}
	checkOnFlappingRelays() {
		const flappingRelaysCount = this.flappingRelays.size;
		const totalRelays = this.relays.size;
		if (flappingRelaysCount / totalRelays >= 0.8) {
			for (const relayUrl of this.flappingRelays) {
				this.backoffTimes.set(relayUrl, 0);
			}
		}
	}
	handleFlapping(relay) {
		this.debug(`Relay ${relay.url} is flapping`);
		let currentBackoff = this.backoffTimes.get(relay.url) || 5000;
		currentBackoff = currentBackoff * 2;
		this.backoffTimes.set(relay.url, currentBackoff);
		this.debug(`Backoff time for ${relay.url} is ${currentBackoff}ms`);
		setTimeout(() => {
			this.debug(`Attempting to reconnect to ${relay.url}`);
			this.emit("relay:connecting", relay);
			relay.connect();
			this.checkOnFlappingRelays();
		}, currentBackoff);
		relay.disconnect();
		this.emit("flapping", relay);
	}
	size() {
		return this.relays.size;
	}
	stats() {
		const stats = {
			total: 0,
			connected: 0,
			disconnected: 0,
			connecting: 0,
		};
		for (const relay of this.relays.values()) {
			stats.total++;
			if (relay.status === 5) {
				stats.connected++;
			} else if (relay.status === 1) {
				stats.disconnected++;
			} else if (relay.status === 4) {
				stats.connecting++;
			}
		}
		return stats;
	}
	connectedRelays() {
		return Array.from(this.relays.values()).filter(
			(relay) => relay.status >= 5,
		);
	}
	permanentAndConnectedRelays() {
		return Array.from(this.relays.values()).filter(
			(relay) => relay.status >= 5 && !this.temporaryRelayTimers.has(relay.url),
		);
	}
	urls() {
		return Array.from(this.relays.keys());
	}
};
var NDKCashuMintList = class _NDKCashuMintList extends NDKEvent {
	static kind = 10019;
	static kinds = [10019];
	_p2pk;
	constructor(ndk, event) {
		super(ndk, event);
		this.kind ??= 10019;
	}
	static from(event) {
		return new _NDKCashuMintList(event.ndk, event);
	}
	set relays(urls) {
		this.tags = this.tags.filter((t) => t[0] !== "relay");
		for (const url of urls) {
			this.tags.push(["relay", url]);
		}
	}
	get relays() {
		const r = [];
		for (const tag of this.tags) {
			if (tag[0] === "relay") {
				r.push(tag[1]);
			}
		}
		return r;
	}
	set mints(urls) {
		this.tags = this.tags.filter((t) => t[0] !== "mint");
		for (const url of urls) {
			this.tags.push(["mint", url]);
		}
	}
	get mints() {
		const r = [];
		for (const tag of this.tags) {
			if (tag[0] === "mint") {
				r.push(tag[1]);
			}
		}
		return Array.from(new Set(r));
	}
	get p2pk() {
		if (this._p2pk) {
			return this._p2pk;
		}
		this._p2pk = this.tagValue("pubkey") ?? this.pubkey;
		return this._p2pk;
	}
	set p2pk(pubkey) {
		this._p2pk = pubkey;
		this.removeTag("pubkey");
		if (pubkey) {
			this.tags.push(["pubkey", pubkey]);
		}
	}
	get relaySet() {
		return NDKRelaySet.fromRelayUrls(this.relays, this.ndk);
	}
};
var NDKArticle = class _NDKArticle extends NDKEvent {
	static kind = 30023;
	static kinds = [30023];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 30023;
	}
	static from(event) {
		return new _NDKArticle(event.ndk, event);
	}
	get title() {
		return this.tagValue("title");
	}
	set title(title) {
		this.removeTag("title");
		if (title) this.tags.push(["title", title]);
	}
	get image() {
		return this.tagValue("image");
	}
	set image(image) {
		this.removeTag("image");
		if (image) this.tags.push(["image", image]);
	}
	get summary() {
		return this.tagValue("summary");
	}
	set summary(summary) {
		this.removeTag("summary");
		if (summary) this.tags.push(["summary", summary]);
	}
	get published_at() {
		const tag = this.tagValue("published_at");
		if (tag) {
			let val = Number.parseInt(tag);
			if (val > 1000000000000) {
				val = Math.floor(val / 1000);
			}
			return val;
		}
		return;
	}
	set published_at(timestamp) {
		this.removeTag("published_at");
		if (timestamp !== undefined) {
			this.tags.push(["published_at", timestamp.toString()]);
		}
	}
	async generateTags() {
		super.generateTags();
		if (!this.published_at) {
			this.published_at = this.created_at;
		}
		return super.generateTags();
	}
	get url() {
		return this.tagValue("url");
	}
	set url(url) {
		if (url) {
			this.tags.push(["url", url]);
		} else {
			this.removeTag("url");
		}
	}
};
function proofsTotalBalance(proofs) {
	return proofs.reduce((acc, proof) => {
		if (proof.amount < 0) {
			throw new Error("proof amount is negative");
		}
		return acc + proof.amount;
	}, 0);
}
var NDKCashuToken = class _NDKCashuToken extends NDKEvent {
	_proofs = [];
	_mint;
	static kind = 7375;
	static kinds = [7375];
	_deletes = [];
	original;
	constructor(ndk, event) {
		super(ndk, event);
		this.kind ??= 7375;
	}
	static async from(event) {
		const token = new _NDKCashuToken(event.ndk, event);
		token.original = event;
		try {
			await token.decrypt();
		} catch {
			token.content = token.original.content;
		}
		try {
			const content = JSON.parse(token.content);
			token.proofs = content.proofs;
			token.mint = content.mint ?? token.tagValue("mint");
			token.deletedTokens = content.del ?? [];
			if (!Array.isArray(token.proofs)) return;
		} catch (_e) {
			return;
		}
		return token;
	}
	get proofs() {
		return this._proofs;
	}
	set proofs(proofs) {
		const cs = /* @__PURE__ */ new Set();
		this._proofs = proofs
			.filter((proof) => {
				if (cs.has(proof.C)) {
					console.warn("Passed in proofs had duplicates, ignoring", proof.C);
					return false;
				}
				if (proof.amount < 0) {
					console.warn("Invalid proof with negative amount", proof);
					return false;
				}
				cs.add(proof.C);
				return true;
			})
			.map(this.cleanProof);
	}
	cleanProof(proof) {
		return {
			id: proof.id,
			amount: proof.amount,
			C: proof.C,
			secret: proof.secret,
		};
	}
	async toNostrEvent(pubkey) {
		if (!this.ndk) throw new Error("no ndk");
		if (!this.ndk.signer) throw new Error("no signer");
		const payload = {
			proofs: this.proofs.map(this.cleanProof),
			mint: this.mint,
			del: this.deletedTokens ?? [],
		};
		this.content = JSON.stringify(payload);
		const user = await this.ndk.signer.user();
		await this.encrypt(user, undefined, "nip44");
		return super.toNostrEvent(pubkey);
	}
	set mint(mint) {
		this._mint = mint;
	}
	get mint() {
		return this._mint;
	}
	get deletedTokens() {
		return this._deletes;
	}
	set deletedTokens(tokenIds) {
		this._deletes = tokenIds;
	}
	get amount() {
		return proofsTotalBalance(this.proofs);
	}
	async publish(relaySet, timeoutMs, requiredRelayCount) {
		if (this.original) {
			return this.original.publish(relaySet, timeoutMs, requiredRelayCount);
		}
		return super.publish(relaySet, timeoutMs, requiredRelayCount);
	}
};
var NDKHighlight = class _NDKHighlight extends NDKEvent {
	_article;
	static kind = 9802;
	static kinds = [9802];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 9802;
	}
	static from(event) {
		return new _NDKHighlight(event.ndk, event);
	}
	get url() {
		return this.tagValue("r");
	}
	set context(context) {
		if (context === undefined) {
			this.tags = this.tags.filter(([tag, _value]) => tag !== "context");
		} else {
			this.tags = this.tags.filter(([tag, _value]) => tag !== "context");
			this.tags.push(["context", context]);
		}
	}
	get context() {
		return (
			this.tags.find(([tag, _value]) => tag === "context")?.[1] ?? undefined
		);
	}
	get article() {
		return this._article;
	}
	set article(article) {
		this._article = article;
		if (typeof article === "string") {
			this.tags.push(["r", article]);
		} else {
			this.tag(article);
		}
	}
	getArticleTag() {
		return (
			this.getMatchingTags("a")[0] ||
			this.getMatchingTags("e")[0] ||
			this.getMatchingTags("r")[0]
		);
	}
	async getArticle() {
		if (this._article !== undefined) return this._article;
		let taggedBech32;
		const articleTag = this.getArticleTag();
		if (!articleTag) return;
		switch (articleTag[0]) {
			case "a": {
				const [kind, pubkey, identifier] = articleTag[1].split(":");
				taggedBech32 = nip19_exports.naddrEncode({
					kind: Number.parseInt(kind),
					pubkey,
					identifier,
				});
				break;
			}
			case "e":
				taggedBech32 = nip19_exports.noteEncode(articleTag[1]);
				break;
			case "r":
				this._article = articleTag[1];
				break;
		}
		if (taggedBech32) {
			let a = await this.ndk?.fetchEvent(taggedBech32);
			if (a) {
				if (a.kind === 30023) {
					a = NDKArticle.from(a);
				}
				this._article = a;
			}
		}
		return this._article;
	}
};
function mapImetaTag(tag) {
	const data = {};
	if (tag.length === 2) {
		const parts = tag[1].split(" ");
		for (let i2 = 0; i2 < parts.length; i2 += 2) {
			const key = parts[i2];
			const value = parts[i2 + 1];
			if (key === "fallback") {
				if (!data.fallback) data.fallback = [];
				data.fallback.push(value);
			} else {
				data[key] = value;
			}
		}
		return data;
	}
	const tags = tag.slice(1);
	for (const val of tags) {
		const parts = val.split(" ");
		const key = parts[0];
		const value = parts.slice(1).join(" ");
		if (key === "fallback") {
			if (!data.fallback) data.fallback = [];
			data.fallback.push(value);
		} else {
			data[key] = value;
		}
	}
	return data;
}
function imetaTagToTag(imeta) {
	const tag = ["imeta"];
	for (const [key, value] of Object.entries(imeta)) {
		if (Array.isArray(value)) {
			for (const v of value) {
				tag.push(`${key} ${v}`);
			}
		} else if (value) {
			tag.push(`${key} ${value}`);
		}
	}
	return tag;
}
var NDKImage = class _NDKImage extends NDKEvent {
	static kind = 20;
	static kinds = [20];
	_imetas;
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 20;
	}
	static from(event) {
		return new _NDKImage(event.ndk, event.rawEvent());
	}
	get isValid() {
		return this.imetas.length > 0;
	}
	get imetas() {
		if (this._imetas) return this._imetas;
		this._imetas = this.tags
			.filter((tag) => tag[0] === "imeta")
			.map(mapImetaTag)
			.filter((imeta) => !!imeta.url);
		return this._imetas;
	}
	set imetas(tags) {
		this._imetas = tags;
		this.tags = this.tags.filter((tag) => tag[0] !== "imeta");
		this.tags.push(...tags.map(imetaTagToTag));
	}
};
var NDKList = class _NDKList extends NDKEvent {
	_encryptedTags;
	static kinds = [
		10063, 30001, 10004, 10050, 10030, 10015, 10001, 10002, 10007, 10006, 10003,
	];
	encryptedTagsLength;
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 30001;
	}
	static from(ndkEvent) {
		return new _NDKList(ndkEvent.ndk, ndkEvent);
	}
	get title() {
		const titleTag = this.tagValue("title") || this.tagValue("name");
		if (titleTag) return titleTag;
		if (this.kind === 3) {
			return "Contacts";
		}
		if (this.kind === 1e4) {
			return "Mute";
		}
		if (this.kind === 10001) {
			return "Pinned Notes";
		}
		if (this.kind === 10002) {
			return "Relay Metadata";
		}
		if (this.kind === 10003) {
			return "Bookmarks";
		}
		if (this.kind === 10004) {
			return "Communities";
		}
		if (this.kind === 10005) {
			return "Public Chats";
		}
		if (this.kind === 10006) {
			return "Blocked Relays";
		}
		if (this.kind === 10007) {
			return "Search Relays";
		}
		if (this.kind === 10050) {
			return "Direct Message Receive Relays";
		}
		if (this.kind === 10015) {
			return "Interests";
		}
		if (this.kind === 10030) {
			return "Emojis";
		}
		return this.tagValue("d");
	}
	set title(title) {
		this.removeTag(["title", "name"]);
		if (title) this.tags.push(["title", title]);
	}
	get name() {
		return this.title;
	}
	set name(name) {
		this.title = name;
	}
	get description() {
		return this.tagValue("description");
	}
	set description(name) {
		this.removeTag("description");
		if (name) this.tags.push(["description", name]);
	}
	get image() {
		return this.tagValue("image");
	}
	set image(name) {
		this.removeTag("image");
		if (name) this.tags.push(["image", name]);
	}
	isEncryptedTagsCacheValid() {
		return !!(
			this._encryptedTags && this.encryptedTagsLength === this.content.length
		);
	}
	async encryptedTags(useCache = true) {
		if (useCache && this.isEncryptedTagsCacheValid())
			return this._encryptedTags;
		if (!this.ndk) throw new Error("NDK instance not set");
		if (!this.ndk.signer) throw new Error("NDK signer not set");
		const user = await this.ndk.signer.user();
		try {
			if (this.content.length > 0) {
				try {
					const decryptedContent = await this.ndk.signer.decrypt(
						user,
						this.content,
					);
					const a = JSON.parse(decryptedContent);
					if (a?.[0]) {
						this.encryptedTagsLength = this.content.length;
						return (this._encryptedTags = a);
					}
					this.encryptedTagsLength = this.content.length;
					return (this._encryptedTags = []);
				} catch (_e) {}
			}
		} catch (_e) {}
		return [];
	}
	validateTag(_tagValue) {
		return true;
	}
	getItems(type) {
		return this.tags.filter((tag) => tag[0] === type);
	}
	get items() {
		return this.tags.filter((t) => {
			return ![
				"d",
				"L",
				"l",
				"title",
				"name",
				"description",
				"published_at",
				"summary",
				"image",
				"thumb",
				"alt",
				"expiration",
				"subject",
				"client",
			].includes(t[0]);
		});
	}
	async addItem(
		item,
		mark = undefined,
		encrypted = false,
		position = "bottom",
	) {
		if (!this.ndk) throw new Error("NDK instance not set");
		if (!this.ndk.signer) throw new Error("NDK signer not set");
		let tags;
		if (item instanceof NDKEvent) {
			tags = [item.tagReference(mark)];
		} else if (item instanceof NDKUser) {
			tags = item.referenceTags();
		} else if (item instanceof NDKRelay) {
			tags = item.referenceTags();
		} else if (Array.isArray(item)) {
			tags = [item];
		} else {
			throw new Error("Invalid object type");
		}
		if (mark) tags[0].push(mark);
		if (encrypted) {
			const user = await this.ndk.signer.user();
			const currentList = await this.encryptedTags();
			if (position === "top") currentList.unshift(...tags);
			else currentList.push(...tags);
			this._encryptedTags = currentList;
			this.encryptedTagsLength = this.content.length;
			this.content = JSON.stringify(currentList);
			await this.encrypt(user);
		} else {
			if (position === "top") this.tags.unshift(...tags);
			else this.tags.push(...tags);
		}
		this.created_at = Math.floor(Date.now() / 1000);
		this.emit("change");
	}
	async removeItemByValue(value, publish = true) {
		if (!this.ndk) throw new Error("NDK instance not set");
		if (!this.ndk.signer) throw new Error("NDK signer not set");
		const index = this.tags.findIndex((tag) => tag[1] === value);
		if (index >= 0) {
			this.tags.splice(index, 1);
		}
		const user = await this.ndk.signer.user();
		const encryptedTags = await this.encryptedTags();
		const encryptedIndex = encryptedTags.findIndex((tag) => tag[1] === value);
		if (encryptedIndex >= 0) {
			encryptedTags.splice(encryptedIndex, 1);
			this._encryptedTags = encryptedTags;
			this.encryptedTagsLength = this.content.length;
			this.content = JSON.stringify(encryptedTags);
			await this.encrypt(user);
		}
		if (publish) {
			return this.publishReplaceable();
		}
		this.created_at = Math.floor(Date.now() / 1000);
		this.emit("change");
	}
	async removeItem(index, encrypted) {
		if (!this.ndk) throw new Error("NDK instance not set");
		if (!this.ndk.signer) throw new Error("NDK signer not set");
		if (encrypted) {
			const user = await this.ndk.signer.user();
			const currentList = await this.encryptedTags();
			currentList.splice(index, 1);
			this._encryptedTags = currentList;
			this.encryptedTagsLength = this.content.length;
			this.content = JSON.stringify(currentList);
			await this.encrypt(user);
		} else {
			this.tags.splice(index, 1);
		}
		this.created_at = Math.floor(Date.now() / 1000);
		this.emit("change");
		return this;
	}
	has(item) {
		return this.items.some((tag) => tag[1] === item);
	}
	filterForItems() {
		const ids = /* @__PURE__ */ new Set();
		const nip33Queries = /* @__PURE__ */ new Map();
		const filters = [];
		for (const tag of this.items) {
			if (tag[0] === "e" && tag[1]) {
				ids.add(tag[1]);
			} else if (tag[0] === "a" && tag[1]) {
				const [kind, pubkey, dTag] = tag[1].split(":");
				if (!kind || !pubkey) continue;
				const key = `${kind}:${pubkey}`;
				const item = nip33Queries.get(key) || [];
				item.push(dTag || "");
				nip33Queries.set(key, item);
			}
		}
		if (ids.size > 0) {
			filters.push({ ids: Array.from(ids) });
		}
		if (nip33Queries.size > 0) {
			for (const [key, values] of nip33Queries.entries()) {
				const [kind, pubkey] = key.split(":");
				filters.push({
					kinds: [Number.parseInt(kind)],
					authors: [pubkey],
					"#d": values,
				});
			}
		}
		return filters;
	}
};
var lists_default = NDKList;
var NDKNutzap = class _NDKNutzap extends NDKEvent {
	debug;
	_proofs = [];
	static kind = 9321;
	static kinds = [_NDKNutzap.kind];
	constructor(ndk, event) {
		super(ndk, event);
		this.kind ??= 9321;
		this.debug =
			ndk?.debug.extend("nutzap") ?? import_debug4.default("ndk:nutzap");
		if (!this.alt) this.alt = "This is a nutzap";
		try {
			const proofTags = this.getMatchingTags("proof");
			if (proofTags.length) {
				this._proofs = proofTags.map((tag) => JSON.parse(tag[1]));
			} else {
				this._proofs = JSON.parse(this.content);
			}
		} catch {
			return;
		}
	}
	static from(event) {
		const e = new _NDKNutzap(event.ndk, event);
		if (!e._proofs || !e._proofs.length) return;
		return e;
	}
	set comment(comment) {
		this.content = comment ?? "";
	}
	get comment() {
		const c = this.tagValue("comment");
		if (c) return c;
		return this.content;
	}
	set proofs(proofs) {
		this._proofs = proofs;
		this.tags = this.tags.filter((tag) => tag[0] !== "proof");
		for (const proof of proofs) {
			this.tags.push(["proof", JSON.stringify(proof)]);
		}
	}
	get proofs() {
		return this._proofs;
	}
	get rawP2pk() {
		const firstProof = this.proofs[0];
		try {
			const secret = JSON.parse(firstProof.secret);
			let payload;
			if (typeof secret === "string") {
				payload = JSON.parse(secret);
				this.debug("stringified payload", firstProof.secret);
			} else if (typeof secret === "object") {
				payload = secret;
			}
			if (
				Array.isArray(payload) &&
				payload[0] === "P2PK" &&
				payload.length > 1 &&
				typeof payload[1] === "object" &&
				payload[1] !== null
			) {
				return payload[1].data;
			}
			if (
				typeof payload === "object" &&
				payload !== null &&
				typeof payload[1]?.data === "string"
			) {
				return payload[1].data;
			}
		} catch (e) {
			this.debug("error parsing p2pk pubkey", e, this.proofs[0]);
		}
		return;
	}
	get p2pk() {
		const rawP2pk = this.rawP2pk;
		if (!rawP2pk) return;
		return rawP2pk.startsWith("02") ? rawP2pk.slice(2) : rawP2pk;
	}
	get mint() {
		return this.tagValue("u");
	}
	set mint(value) {
		this.replaceTag(["u", value]);
	}
	get unit() {
		let _unit = this.tagValue("unit") ?? "sat";
		if (_unit?.startsWith("msat")) _unit = "sat";
		return _unit;
	}
	set unit(value) {
		this.removeTag("unit");
		if (value?.startsWith("msat"))
			throw new Error("msat is not allowed, use sat denomination instead");
		if (value) this.tag(["unit", value]);
	}
	get amount() {
		const amount = this.proofs.reduce(
			(total, proof) => total + proof.amount,
			0,
		);
		return amount;
	}
	sender = this.author;
	set target(target) {
		this.tags = this.tags.filter((t) => t[0] !== "p");
		if (target instanceof NDKEvent) {
			this.tags.push(target.tagReference());
		}
	}
	set recipientPubkey(pubkey) {
		this.removeTag("p");
		this.tag(["p", pubkey]);
	}
	get recipientPubkey() {
		return this.tagValue("p");
	}
	get recipient() {
		const pubkey = this.recipientPubkey;
		if (this.ndk) return this.ndk.getUser({ pubkey });
		return new NDKUser({ pubkey });
	}
	async toNostrEvent() {
		if (this.unit === "msat") {
			this.unit = "sat";
		}
		this.removeTag("amount");
		this.tags.push(["amount", this.amount.toString()]);
		const event = await super.toNostrEvent();
		event.content = this.comment;
		return event;
	}
	get isValid() {
		let eTagCount = 0;
		let pTagCount = 0;
		let mintTagCount = 0;
		for (const tag of this.tags) {
			if (tag[0] === "e") eTagCount++;
			if (tag[0] === "p") pTagCount++;
			if (tag[0] === "u") mintTagCount++;
		}
		return (
			pTagCount === 1 &&
			mintTagCount === 1 &&
			eTagCount <= 1 &&
			this.proofs.length > 0
		);
	}
};
var NDKSimpleGroupMemberList = class _NDKSimpleGroupMemberList extends NDKEvent {
	relaySet;
	memberSet = /* @__PURE__ */ new Set();
	static kind = 39002;
	static kinds = [39002];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 39002;
		this.memberSet = new Set(this.members);
	}
	static from(event) {
		return new _NDKSimpleGroupMemberList(event.ndk, event);
	}
	get members() {
		return this.getMatchingTags("p").map((tag) => tag[1]);
	}
	hasMember(member) {
		return this.memberSet.has(member);
	}
	async publish(relaySet, timeoutMs, requiredRelayCount) {
		relaySet ??= this.relaySet;
		return super.publishReplaceable(relaySet, timeoutMs, requiredRelayCount);
	}
};
var NDKSimpleGroupMetadata = class _NDKSimpleGroupMetadata extends NDKEvent {
	static kind = 39000;
	static kinds = [39000];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 39000;
	}
	static from(event) {
		return new _NDKSimpleGroupMetadata(event.ndk, event);
	}
	get name() {
		return this.tagValue("name");
	}
	get picture() {
		return this.tagValue("picture");
	}
	get about() {
		return this.tagValue("about");
	}
	get scope() {
		if (this.getMatchingTags("public").length > 0) return "public";
		if (this.getMatchingTags("public").length > 0) return "private";
		return;
	}
	set scope(scope) {
		this.removeTag("public");
		this.removeTag("private");
		if (scope === "public") {
			this.tags.push(["public", ""]);
		} else if (scope === "private") {
			this.tags.push(["private", ""]);
		}
	}
	get access() {
		if (this.getMatchingTags("open").length > 0) return "open";
		if (this.getMatchingTags("closed").length > 0) return "closed";
		return;
	}
	set access(access) {
		this.removeTag("open");
		this.removeTag("closed");
		if (access === "open") {
			this.tags.push(["open", ""]);
		} else if (access === "closed") {
			this.tags.push(["closed", ""]);
		}
	}
};
function strToPosition(positionStr) {
	const [x, y] = positionStr.split(",").map(Number);
	return { x, y };
}
function strToDimension(dimensionStr) {
	const [width, height] = dimensionStr.split("x").map(Number);
	return { width, height };
}
var NDKStorySticker = class _NDKStorySticker {
	static Text = "text";
	static Pubkey = "pubkey";
	static Event = "event";
	static Prompt = "prompt";
	static Countdown = "countdown";
	type;
	value;
	position;
	dimension;
	properties;
	constructor(arg) {
		if (Array.isArray(arg)) {
			const tag = arg;
			if (tag[0] !== "sticker" || tag.length < 5) {
				throw new Error("Invalid sticker tag");
			}
			this.type = tag[1];
			this.value = tag[2];
			this.position = strToPosition(tag[3]);
			this.dimension = strToDimension(tag[4]);
			const props = {};
			for (let i2 = 5; i2 < tag.length; i2++) {
				const [key, ...rest] = tag[i2].split(" ");
				props[key] = rest.join(" ");
			}
			if (Object.keys(props).length > 0) {
				this.properties = props;
			}
		} else {
			this.type = arg;
			this.value = undefined;
			this.position = { x: 0, y: 0 };
			this.dimension = { width: 0, height: 0 };
		}
	}
	static fromTag(tag) {
		try {
			return new _NDKStorySticker(tag);
		} catch {
			return null;
		}
	}
	get style() {
		return this.properties?.style;
	}
	set style(style) {
		if (style) this.properties = { ...this.properties, style };
		else delete this.properties?.style;
	}
	get rotation() {
		return this.properties?.rot
			? Number.parseFloat(this.properties.rot)
			: undefined;
	}
	set rotation(rotation) {
		if (rotation !== undefined) {
			this.properties = { ...this.properties, rot: rotation.toString() };
		} else {
			delete this.properties?.rot;
		}
	}
	get isValid() {
		return this.hasValidDimensions() && this.hasValidPosition();
	}
	hasValidDimensions = () => {
		return (
			typeof this.dimension.width === "number" &&
			typeof this.dimension.height === "number" &&
			!Number.isNaN(this.dimension.width) &&
			!Number.isNaN(this.dimension.height)
		);
	};
	hasValidPosition = () => {
		return (
			typeof this.position.x === "number" &&
			typeof this.position.y === "number" &&
			!Number.isNaN(this.position.x) &&
			!Number.isNaN(this.position.y)
		);
	};
	toTag() {
		if (!this.isValid) {
			const errors = [
				!this.hasValidDimensions() ? "dimensions is invalid" : undefined,
				!this.hasValidPosition() ? "position is invalid" : undefined,
			].filter(Boolean);
			throw new Error(`Invalid sticker: ${errors.join(", ")}`);
		}
		let value;
		switch (this.type) {
			case "event":
				value = this.value.tagId();
				break;
			case "pubkey":
				value = this.value.pubkey;
				break;
			default:
				value = this.value;
		}
		const tag = [
			"sticker",
			this.type,
			value,
			coordinates(this.position),
			dimension(this.dimension),
		];
		if (this.properties) {
			for (const [key, propValue] of Object.entries(this.properties)) {
				tag.push(`${key} ${propValue}`);
			}
		}
		return tag;
	}
};
var NDKStory = class _NDKStory extends NDKEvent {
	static kind = 23;
	static kinds = [23];
	_imeta;
	_dimensions;
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 23;
		if (rawEvent) {
			for (const tag of rawEvent.tags) {
				switch (tag[0]) {
					case "imeta":
						this._imeta = mapImetaTag(tag);
						break;
					case "dim":
						this.dimensions = strToDimension(tag[1]);
						break;
				}
			}
		}
	}
	static from(event) {
		return new _NDKStory(event.ndk, event);
	}
	get isValid() {
		return !!this.imeta;
	}
	get imeta() {
		return this._imeta;
	}
	set imeta(tag) {
		this._imeta = tag;
		this.tags = this.tags.filter((t) => t[0] !== "imeta");
		if (tag) {
			this.tags.push(imetaTagToTag(tag));
		}
	}
	get dimensions() {
		const dimTag = this.tagValue("dim");
		if (!dimTag) return;
		return strToDimension(dimTag);
	}
	set dimensions(dimensions) {
		this.removeTag("dim");
		if (dimensions) {
			this.tags.push(["dim", `${dimensions.width}x${dimensions.height}`]);
		}
	}
	get duration() {
		const durTag = this.tagValue("dur");
		if (!durTag) return;
		return Number.parseInt(durTag);
	}
	set duration(duration) {
		this.removeTag("dur");
		if (duration !== undefined) {
			this.tags.push(["dur", duration.toString()]);
		}
	}
	get stickers() {
		const stickers = [];
		for (const tag of this.tags) {
			if (tag[0] !== "sticker" || tag.length < 5) continue;
			const sticker = NDKStorySticker.fromTag(tag);
			if (sticker) stickers.push(sticker);
		}
		return stickers;
	}
	addSticker(sticker) {
		let stickerToAdd;
		if (sticker instanceof NDKStorySticker) {
			stickerToAdd = sticker;
		} else {
			const tag = [
				"sticker",
				sticker.type,
				typeof sticker.value === "string" ? sticker.value : "",
				coordinates(sticker.position),
				dimension(sticker.dimension),
			];
			if (sticker.properties) {
				for (const [key, value] of Object.entries(sticker.properties)) {
					tag.push(`${key} ${value}`);
				}
			}
			stickerToAdd = new NDKStorySticker(tag);
			stickerToAdd.value = sticker.value;
		}
		if (stickerToAdd.type === "pubkey") {
			this.tag(stickerToAdd.value);
		} else if (stickerToAdd.type === "event") {
			this.tag(stickerToAdd.value);
		}
		this.tags.push(stickerToAdd.toTag());
	}
	removeSticker(index) {
		const stickers = this.stickers;
		if (index < 0 || index >= stickers.length) return;
		let stickerCount = 0;
		for (let i2 = 0; i2 < this.tags.length; i2++) {
			if (this.tags[i2][0] === "sticker") {
				if (stickerCount === index) {
					this.tags.splice(i2, 1);
					break;
				}
				stickerCount++;
			}
		}
	}
};
var coordinates = (position) => `${position.x},${position.y}`;
var dimension = (dimension2) => `${dimension2.width}x${dimension2.height}`;
var possibleIntervalFrequencies = [
	"daily",
	"weekly",
	"monthly",
	"quarterly",
	"yearly",
];
function newAmount(amount, currency, term) {
	return ["amount", amount.toString(), currency, term];
}
function parseTagToSubscriptionAmount(tag) {
	const amount = Number.parseInt(tag[1]);
	if (
		Number.isNaN(amount) ||
		amount === undefined ||
		amount === null ||
		amount <= 0
	)
		return;
	const currency = tag[2];
	if (currency === undefined || currency === "") return;
	const term = tag[3];
	if (term === undefined) return;
	if (!possibleIntervalFrequencies.includes(term)) return;
	return {
		amount,
		currency,
		term,
	};
}
var NDKSubscriptionTier = class _NDKSubscriptionTier extends NDKArticle {
	static kind = 37001;
	static kinds = [37001];
	constructor(ndk, rawEvent) {
		const k = rawEvent?.kind ?? 37001;
		super(ndk, rawEvent);
		this.kind = k;
	}
	static from(event) {
		return new _NDKSubscriptionTier(event.ndk, event);
	}
	get perks() {
		return this.getMatchingTags("perk")
			.map((tag) => tag[1])
			.filter((perk) => perk !== undefined);
	}
	addPerk(perk) {
		this.tags.push(["perk", perk]);
	}
	get amounts() {
		return this.getMatchingTags("amount")
			.map((tag) => parseTagToSubscriptionAmount(tag))
			.filter((a) => a !== undefined);
	}
	addAmount(amount, currency, term) {
		this.tags.push(newAmount(amount, currency, term));
	}
	set relayUrl(relayUrl) {
		this.tags.push(["r", relayUrl]);
	}
	get relayUrls() {
		return this.getMatchingTags("r")
			.map((tag) => tag[1])
			.filter((relay) => relay !== undefined);
	}
	get verifierPubkey() {
		return this.tagValue("p");
	}
	set verifierPubkey(pubkey) {
		this.removeTag("p");
		if (pubkey) this.tags.push(["p", pubkey]);
	}
	get isValid() {
		return this.title !== undefined && this.amounts.length > 0;
	}
};
var NDKVideo = class _NDKVideo extends NDKEvent {
	static kind = 21;
	static kinds = [34235, 34236, 22, 21];
	_imetas;
	static from(event) {
		return new _NDKVideo(event.ndk, event.rawEvent());
	}
	get title() {
		return this.tagValue("title");
	}
	set title(title) {
		this.removeTag("title");
		if (title) this.tags.push(["title", title]);
	}
	get thumbnail() {
		let thumbnail;
		if (this.imetas && this.imetas.length > 0) {
			thumbnail = this.imetas[0].image?.[0];
		}
		return thumbnail ?? this.tagValue("thumb");
	}
	get imetas() {
		if (this._imetas) return this._imetas;
		this._imetas = this.tags
			.filter((tag) => tag[0] === "imeta")
			.map(mapImetaTag);
		return this._imetas;
	}
	set imetas(tags) {
		this._imetas = tags;
		this.tags = this.tags.filter((tag) => tag[0] !== "imeta");
		this.tags.push(...tags.map(imetaTagToTag));
	}
	get url() {
		if (this.imetas && this.imetas.length > 0) {
			return this.imetas[0].url;
		}
		return this.tagValue("url");
	}
	get published_at() {
		const tag = this.tagValue("published_at");
		if (tag) {
			return Number.parseInt(tag);
		}
		return;
	}
	async generateTags() {
		super.generateTags();
		if (!this.kind) {
			if (this.imetas?.[0]?.dim) {
				const [width, height] = this.imetas[0].dim.split("x");
				const isPortrait =
					width && height && Number.parseInt(width) < Number.parseInt(height);
				const isShort = this.duration && this.duration < 120;
				if (isShort && isPortrait) this.kind = 22;
				else this.kind = 21;
			}
		}
		return super.generateTags();
	}
	get duration() {
		const tag = this.tagValue("duration");
		if (tag) {
			return Number.parseInt(tag);
		}
		return;
	}
	set duration(dur) {
		this.removeTag("duration");
		if (dur !== undefined) {
			this.tags.push(["duration", Math.floor(dur).toString()]);
		}
	}
};
var NDKWiki = class _NDKWiki extends NDKArticle {
	static kind = 30818;
	static kinds = [30818];
	static from(event) {
		return new _NDKWiki(event.ndk, event.rawEvent());
	}
	get isDefered() {
		return this.hasTag("a", "defer");
	}
	get deferedId() {
		return this.tagValue("a", "defer");
	}
	set defer(deferedTo) {
		this.removeTag("a", "defer");
		this.tag(deferedTo, "defer");
	}
};
var NDKBlossomList = class _NDKBlossomList extends NDKEvent {
	static kinds = [10063];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 10063;
	}
	static from(ndkEvent) {
		return new _NDKBlossomList(ndkEvent.ndk, ndkEvent.rawEvent());
	}
	get servers() {
		return this.tags.filter((tag) => tag[0] === "server").map((tag) => tag[1]);
	}
	set servers(servers) {
		this.tags = this.tags.filter((tag) => tag[0] !== "server");
		for (const server of servers) {
			this.tags.push(["server", server]);
		}
	}
	get default() {
		const servers = this.servers;
		return servers.length > 0 ? servers[0] : undefined;
	}
	set default(server) {
		if (!server) return;
		const currentServers = this.servers;
		const filteredServers = currentServers.filter((s) => s !== server);
		this.servers = [server, ...filteredServers];
	}
	addServer(server) {
		if (!server) return;
		const currentServers = this.servers;
		if (!currentServers.includes(server)) {
			this.servers = [...currentServers, server];
		}
	}
	removeServer(server) {
		if (!server) return;
		const currentServers = this.servers;
		this.servers = currentServers.filter((s) => s !== server);
	}
};
var NDKFollowPack = class _NDKFollowPack extends NDKEvent {
	static kind = 39089;
	static kinds = [39089, 39092];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 39089;
	}
	static from(ndkEvent) {
		return new _NDKFollowPack(ndkEvent.ndk, ndkEvent);
	}
	get title() {
		return this.tagValue("title");
	}
	set title(value) {
		this.removeTag("title");
		if (value) this.tags.push(["title", value]);
	}
	get image() {
		const imetaTag = this.tags.find((tag) => tag[0] === "imeta");
		if (imetaTag) {
			const imeta = mapImetaTag(imetaTag);
			if (imeta.url) return imeta.url;
		}
		return this.tagValue("image");
	}
	set image(value) {
		this.tags = this.tags.filter(
			(tag) => tag[0] !== "imeta" && tag[0] !== "image",
		);
		if (typeof value === "string") {
			if (value !== undefined) {
				this.tags.push(["image", value]);
			}
		} else if (value && typeof value === "object") {
			this.tags.push(imetaTagToTag(value));
			if (value.url) {
				this.tags.push(["image", value.url]);
			}
		}
	}
	get pubkeys() {
		return Array.from(
			new Set(this.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1])),
		);
	}
	set pubkeys(pubkeys) {
		this.tags = this.tags.filter((tag) => tag[0] !== "p");
		for (const pubkey of pubkeys) {
			this.tags.push(["p", pubkey]);
		}
	}
	get description() {
		return this.tagValue("description");
	}
	set description(value) {
		this.removeTag("description");
		if (value) this.tags.push(["description", value]);
	}
};
var signerRegistry = /* @__PURE__ */ new Map();
function registerSigner(type, signerClass) {
	signerRegistry.set(type, signerClass);
}
var NDKPrivateKeySigner = class _NDKPrivateKeySigner {
	_user;
	_privateKey;
	_pubkey;
	constructor(privateKeyOrNsec, ndk) {
		if (typeof privateKeyOrNsec === "string") {
			if (privateKeyOrNsec.startsWith("nsec1")) {
				const { type, data } = nip19_exports.decode(privateKeyOrNsec);
				if (type === "nsec") this._privateKey = data;
				else throw new Error("Invalid private key provided.");
			} else if (privateKeyOrNsec.length === 64) {
				this._privateKey = hexToBytes3(privateKeyOrNsec);
			} else {
				throw new Error("Invalid private key provided.");
			}
		} else {
			this._privateKey = privateKeyOrNsec;
		}
		this._pubkey = getPublicKey(this._privateKey);
		if (ndk) this._user = ndk.getUser({ pubkey: this._pubkey });
		this._user ??= new NDKUser({ pubkey: this._pubkey });
	}
	get privateKey() {
		if (!this._privateKey) throw new Error("Not ready");
		return bytesToHex3(this._privateKey);
	}
	get pubkey() {
		if (!this._pubkey) throw new Error("Not ready");
		return this._pubkey;
	}
	get nsec() {
		if (!this._privateKey) throw new Error("Not ready");
		return nip19_exports.nsecEncode(this._privateKey);
	}
	get npub() {
		if (!this._pubkey) throw new Error("Not ready");
		return nip19_exports.npubEncode(this._pubkey);
	}
	static generate() {
		const privateKey = generateSecretKey();
		return new _NDKPrivateKeySigner(privateKey);
	}
	async blockUntilReady() {
		return this._user;
	}
	async user() {
		return this._user;
	}
	get userSync() {
		return this._user;
	}
	async sign(event) {
		if (!this._privateKey) {
			throw Error("Attempted to sign without a private key");
		}
		return finalizeEvent(event, this._privateKey).sig;
	}
	async encryptionEnabled(scheme) {
		const enabled = [];
		if (!scheme || scheme === "nip04") enabled.push("nip04");
		if (!scheme || scheme === "nip44") enabled.push("nip44");
		return enabled;
	}
	async encrypt(recipient, value, scheme) {
		if (!this._privateKey || !this.privateKey) {
			throw Error("Attempted to encrypt without a private key");
		}
		const recipientHexPubKey = recipient.pubkey;
		if (scheme === "nip44") {
			const conversationKey = nip44_exports.v2.utils.getConversationKey(
				this._privateKey,
				recipientHexPubKey,
			);
			return await nip44_exports.v2.encrypt(value, conversationKey);
		}
		return await nip04_exports.encrypt(
			this._privateKey,
			recipientHexPubKey,
			value,
		);
	}
	async decrypt(sender, value, scheme) {
		if (!this._privateKey || !this.privateKey) {
			throw Error("Attempted to decrypt without a private key");
		}
		const senderHexPubKey = sender.pubkey;
		if (scheme === "nip44") {
			const conversationKey = nip44_exports.v2.utils.getConversationKey(
				this._privateKey,
				senderHexPubKey,
			);
			return await nip44_exports.v2.decrypt(value, conversationKey);
		}
		return await nip04_exports.decrypt(
			this._privateKey,
			senderHexPubKey,
			value,
		);
	}
	toPayload() {
		if (!this._privateKey) throw new Error("Private key not available");
		const payload = {
			type: "private-key",
			payload: this.privateKey,
		};
		return JSON.stringify(payload);
	}
	static async fromPayload(payloadString, ndk) {
		const payload = JSON.parse(payloadString);
		if (payload.type !== "private-key") {
			throw new Error(
				`Invalid payload type: expected 'private-key', got ${payload.type}`,
			);
		}
		if (!payload.payload || typeof payload.payload !== "string") {
			throw new Error("Invalid payload content for private-key signer");
		}
		return new _NDKPrivateKeySigner(payload.payload, ndk);
	}
};
registerSigner("private-key", NDKPrivateKeySigner);
var NDKProject = class _NDKProject extends NDKEvent {
	static kind = 31933;
	static kinds = [_NDKProject.kind];
	_signer;
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind = 31933;
	}
	static from(event) {
		return new _NDKProject(event.ndk, event.rawEvent());
	}
	set repo(value) {
		this.removeTag("repo");
		if (value) this.tags.push(["repo", value]);
	}
	set hashtags(values) {
		this.removeTag("hashtags");
		if (values.filter((t) => t.length > 0).length)
			this.tags.push(["hashtags", ...values]);
	}
	get hashtags() {
		const tag = this.tags.find((tag2) => tag2[0] === "hashtags");
		return tag ? tag.slice(1) : [];
	}
	get repo() {
		return this.tagValue("repo");
	}
	get title() {
		return this.tagValue("title");
	}
	set title(value) {
		this.removeTag("title");
		if (value) this.tags.push(["title", value]);
	}
	get picture() {
		return this.tagValue("picture");
	}
	set picture(value) {
		this.removeTag("picture");
		if (value) this.tags.push(["picture", value]);
	}
	set description(value) {
		this.content = value;
	}
	get description() {
		return this.content;
	}
	get slug() {
		return this.dTag ?? "empty-dtag";
	}
	async getSigner() {
		if (this._signer) return this._signer;
		const encryptedKey = this.tagValue("key");
		if (!encryptedKey) {
			this._signer = NDKPrivateKeySigner.generate();
			await this.encryptAndSaveNsec();
		} else {
			const decryptedKey = await this.ndk?.signer?.decrypt(
				this.ndk.activeUser,
				encryptedKey,
			);
			if (!decryptedKey) {
				throw new Error(
					"Failed to decrypt project key or missing signer context.",
				);
			}
			this._signer = new NDKPrivateKeySigner(decryptedKey);
		}
		return this._signer;
	}
	async getNsec() {
		const signer = await this.getSigner();
		return signer.privateKey;
	}
	async setNsec(value) {
		this._signer = new NDKPrivateKeySigner(value);
		await this.encryptAndSaveNsec();
	}
	async encryptAndSaveNsec() {
		if (!this._signer) throw new Error("Signer is not set.");
		const key = this._signer.privateKey;
		const encryptedKey = await this.ndk?.signer?.encrypt(
			this.ndk.activeUser,
			key,
		);
		if (encryptedKey) {
			this.removeTag("key");
			this.tags.push(["key", encryptedKey]);
		}
	}
};
var registeredEventClasses = /* @__PURE__ */ new Set();
function wrapEvent3(event) {
	const eventWrappingMap = /* @__PURE__ */ new Map();
	const builtInClasses = [
		NDKImage,
		NDKVideo,
		NDKCashuMintList,
		NDKArticle,
		NDKHighlight,
		NDKDraft,
		NDKWiki,
		NDKNutzap,
		NDKProject,
		NDKTask,
		NDKProjectTemplate,
		NDKSimpleGroupMemberList,
		NDKSimpleGroupMetadata,
		NDKSubscriptionTier,
		NDKCashuToken,
		NDKList,
		NDKStory,
		NDKBlossomList,
		NDKFollowPack,
	];
	const allClasses = [...builtInClasses, ...registeredEventClasses];
	for (const klass2 of allClasses) {
		for (const kind of klass2.kinds) {
			eventWrappingMap.set(kind, klass2);
		}
	}
	const klass = eventWrappingMap.get(event.kind);
	if (klass) return klass.from(event);
	return event;
}
function queryFullyFilled(subscription) {
	if (filterIncludesIds(subscription.filter)) {
		if (resultHasAllRequestedIds(subscription)) {
			return true;
		}
	}
	return false;
}
function filterIncludesIds(filter) {
	return !!filter.ids;
}
function resultHasAllRequestedIds(subscription) {
	const ids = subscription.filter.ids;
	return !!ids && ids.length === subscription.eventFirstSeen.size;
}
function filterFromId(id) {
	let decoded;
	if (id.match(NIP33_A_REGEX)) {
		const [kind, pubkey, identifier] = id.split(":");
		const filter = {
			authors: [pubkey],
			kinds: [Number.parseInt(kind)],
		};
		if (identifier) {
			filter["#d"] = [identifier];
		}
		return filter;
	}
	if (id.match(BECH32_REGEX2)) {
		try {
			decoded = nip19_exports.decode(id);
			switch (decoded.type) {
				case "nevent": {
					const filter = { ids: [decoded.data.id] };
					if (decoded.data.author) filter.authors = [decoded.data.author];
					if (decoded.data.kind) filter.kinds = [decoded.data.kind];
					return filter;
				}
				case "note":
					return { ids: [decoded.data] };
				case "naddr": {
					const filter = {
						authors: [decoded.data.pubkey],
						kinds: [decoded.data.kind],
					};
					if (decoded.data.identifier) filter["#d"] = [decoded.data.identifier];
					return filter;
				}
			}
		} catch (e) {
			console.error("Error decoding", id, e);
		}
	}
	return { ids: [id] };
}
function isNip33AValue(value) {
	return value.match(NIP33_A_REGEX) !== null;
}
var NIP33_A_REGEX = /^(\d+):([0-9A-Fa-f]+)(?::(.*))?$/;
var BECH32_REGEX2 = /^n(event|ote|profile|pub|addr)1[\d\w]+$/;
function relaysFromBech32(bech322, ndk) {
	try {
		const decoded = nip19_exports.decode(bech322);
		if (["naddr", "nevent"].includes(decoded?.type)) {
			const data = decoded.data;
			if (data?.relays) {
				return data.relays.map(
					(r) => new NDKRelay(r, ndk.relayAuthDefaultPolicy, ndk),
				);
			}
		}
	} catch (_e) {}
	return [];
}
var defaultOpts = {
	closeOnEose: false,
	cacheUsage: "CACHE_FIRST",
	dontSaveToCache: false,
	groupable: true,
	groupableDelay: 100,
	groupableDelayType: "at-most",
	cacheUnconstrainFilter: ["limit", "since", "until"],
};
var NDKSubscription = class extends import_tseep4.EventEmitter {
	subId;
	filters;
	opts;
	pool;
	skipVerification = false;
	skipValidation = false;
	relayFilters;
	relaySet;
	ndk;
	debug;
	eventFirstSeen = /* @__PURE__ */ new Map();
	eosesSeen = /* @__PURE__ */ new Set();
	lastEventReceivedAt;
	mostRecentCacheEventTimestamp;
	internalId;
	closeOnEose;
	poolMonitor;
	skipOptimisticPublishEvent = false;
	cacheUnconstrainFilter;
	constructor(ndk, filters, opts, subId) {
		super();
		this.ndk = ndk;
		this.opts = { ...defaultOpts, ...(opts || {}) };
		this.pool = this.opts.pool || ndk.pool;
		this.filters = Array.isArray(filters) ? filters : [filters];
		this.subId = subId || this.opts.subId;
		this.internalId = Math.random().toString(36).substring(7);
		this.debug = ndk.debug.extend(
			`subscription[${this.opts.subId ?? this.internalId}]`,
		);
		if (this.opts.relaySet) {
			this.relaySet = this.opts.relaySet;
		} else if (this.opts.relayUrls) {
			this.relaySet = NDKRelaySet.fromRelayUrls(this.opts.relayUrls, this.ndk);
		}
		this.skipVerification = this.opts.skipVerification || false;
		this.skipValidation = this.opts.skipValidation || false;
		this.closeOnEose = this.opts.closeOnEose || false;
		this.skipOptimisticPublishEvent =
			this.opts.skipOptimisticPublishEvent || false;
		this.cacheUnconstrainFilter = this.opts.cacheUnconstrainFilter;
	}
	relaysMissingEose() {
		if (!this.relayFilters) return [];
		const relaysMissingEose = Array.from(this.relayFilters?.keys()).filter(
			(url) => !this.eosesSeen.has(this.pool.getRelay(url, false, false)),
		);
		return relaysMissingEose;
	}
	get filter() {
		return this.filters[0];
	}
	get groupableDelay() {
		if (!this.isGroupable()) return;
		return this.opts?.groupableDelay;
	}
	get groupableDelayType() {
		return this.opts?.groupableDelayType || "at-most";
	}
	isGroupable() {
		return this.opts?.groupable || false;
	}
	shouldQueryCache() {
		if (this.opts.addSinceFromCache) return true;
		if (this.opts?.cacheUsage === "ONLY_RELAY") return false;
		const hasNonEphemeralKind = this.filters.some((f) =>
			f.kinds?.some((k) => kindIsEphemeral(k)),
		);
		if (hasNonEphemeralKind) return true;
		return true;
	}
	shouldQueryRelays() {
		return this.opts?.cacheUsage !== "ONLY_CACHE";
	}
	shouldWaitForCache() {
		if (this.opts.addSinceFromCache) return true;
		return (
			!!this.opts.closeOnEose &&
			!!this.ndk.cacheAdapter?.locking &&
			this.opts.cacheUsage !== "PARALLEL"
		);
	}
	start(emitCachedEvents = true) {
		let cacheResult;
		const updateStateFromCacheResults = (events) => {
			if (emitCachedEvents) {
				for (const event of events) {
					if (
						!this.mostRecentCacheEventTimestamp ||
						event.created_at > this.mostRecentCacheEventTimestamp
					) {
						this.mostRecentCacheEventTimestamp = event.created_at;
					}
					this.eventReceived(event, undefined, true, false);
				}
			} else {
				cacheResult = [];
				for (const event of events) {
					if (
						!this.mostRecentCacheEventTimestamp ||
						event.created_at > this.mostRecentCacheEventTimestamp
					) {
						this.mostRecentCacheEventTimestamp = event.created_at;
					}
					event.ndk = this.ndk;
					const e = this.opts.wrap ? wrapEvent3(event) : event;
					if (!e) break;
					if (e instanceof Promise) {
						e.then((wrappedEvent) => {
							this.emitEvent(false, wrappedEvent, undefined, true, false);
						});
						break;
					}
					this.eventFirstSeen.set(e.id, Date.now());
					cacheResult.push(e);
				}
			}
		};
		const loadFromRelays = () => {
			if (this.shouldQueryRelays()) {
				this.startWithRelays();
				this.startPoolMonitor();
			} else {
				this.emit("eose", this);
			}
		};
		if (this.shouldQueryCache()) {
			cacheResult = this.startWithCache();
			if (cacheResult instanceof Promise) {
				if (this.shouldWaitForCache()) {
					cacheResult.then((events) => {
						updateStateFromCacheResults(events);
						if (queryFullyFilled(this)) {
							this.emit("eose", this);
							return;
						}
						loadFromRelays();
					});
					return null;
				}
				cacheResult.then((events) => {
					updateStateFromCacheResults(events);
				});
				loadFromRelays();
				return null;
			}
			updateStateFromCacheResults(cacheResult);
			if (queryFullyFilled(this)) {
				this.emit("eose", this);
			} else {
				loadFromRelays();
			}
			return cacheResult;
		}
		loadFromRelays();
		return null;
	}
	startPoolMonitor() {
		const _d = this.debug.extend("pool-monitor");
		this.poolMonitor = (relay) => {
			if (this.relayFilters?.has(relay.url)) return;
			const calc = calculateRelaySetsFromFilters(
				this.ndk,
				this.filters,
				this.pool,
			);
			if (calc.get(relay.url)) {
				this.relayFilters?.set(relay.url, this.filters);
				relay.subscribe(this, this.filters);
			}
		};
		this.pool.on("relay:connect", this.poolMonitor);
	}
	onStopped;
	stop() {
		this.emit("close", this);
		this.poolMonitor && this.pool.off("relay:connect", this.poolMonitor);
		this.onStopped?.();
	}
	hasAuthorsFilter() {
		return this.filters.some((f) => f.authors?.length);
	}
	startWithCache() {
		if (this.ndk.cacheAdapter?.query) {
			return this.ndk.cacheAdapter.query(this);
		}
		return [];
	}
	startWithRelays() {
		let filters = this.filters;
		if (this.opts.addSinceFromCache && this.mostRecentCacheEventTimestamp) {
			const sinceTimestamp = this.mostRecentCacheEventTimestamp + 1;
			filters = filters.map((filter) => ({
				...filter,
				since: Math.max(filter.since || 0, sinceTimestamp),
			}));
		}
		if (!this.relaySet || this.relaySet.relays.size === 0) {
			this.relayFilters = calculateRelaySetsFromFilters(
				this.ndk,
				filters,
				this.pool,
			);
		} else {
			this.relayFilters = /* @__PURE__ */ new Map();
			for (const relay of this.relaySet.relays) {
				this.relayFilters.set(relay.url, filters);
			}
		}
		for (const [relayUrl, filters2] of this.relayFilters) {
			const relay = this.pool.getRelay(relayUrl, true, true, filters2);
			relay.subscribe(this, filters2);
		}
	}
	eventReceived(event, relay, fromCache = false, optimisticPublish = false) {
		const eventId = event.id;
		const eventAlreadySeen = this.eventFirstSeen.has(eventId);
		let ndkEvent;
		if (event instanceof NDKEvent) ndkEvent = event;
		if (!eventAlreadySeen) {
			ndkEvent ??= new NDKEvent(this.ndk, event);
			ndkEvent.ndk = this.ndk;
			ndkEvent.relay = relay;
			if (!fromCache && !optimisticPublish) {
				if (!this.skipValidation) {
					if (!ndkEvent.isValid) {
						this.debug(
							"Event failed validation %s from relay %s",
							eventId,
							relay?.url,
						);
						return;
					}
				}
				if (relay) {
					const shouldVerify = relay.shouldValidateEvent();
					if (shouldVerify && !this.skipVerification) {
						ndkEvent.relay = relay;
						if (!this.ndk.asyncSigVerification) {
							if (!ndkEvent.verifySignature(true)) {
								this.debug("Event failed signature validation", event);
								this.ndk.reportInvalidSignature(ndkEvent, relay);
								return;
							}
							relay.addValidatedEvent();
						}
					} else {
						relay.addNonValidatedEvent();
					}
				}
				if (this.ndk.cacheAdapter && !this.opts.dontSaveToCache) {
					this.ndk.cacheAdapter.setEvent(ndkEvent, this.filters, relay);
				}
			}
			if (!optimisticPublish || this.skipOptimisticPublishEvent !== true) {
				this.emitEvent(
					this.opts?.wrap ?? false,
					ndkEvent,
					relay,
					fromCache,
					optimisticPublish,
				);
				this.eventFirstSeen.set(eventId, Date.now());
			}
		} else {
			const timeSinceFirstSeen =
				Date.now() - (this.eventFirstSeen.get(eventId) || 0);
			this.emit(
				"event:dup",
				event,
				relay,
				timeSinceFirstSeen,
				this,
				fromCache,
				optimisticPublish,
			);
			if (relay) {
				const signature = verifiedSignatures.get(eventId);
				if (signature && typeof signature === "string") {
					if (event.sig === signature) {
						relay.addValidatedEvent();
					} else {
						const eventToReport =
							event instanceof NDKEvent ? event : new NDKEvent(this.ndk, event);
						this.ndk.reportInvalidSignature(eventToReport, relay);
					}
				}
			}
		}
		this.lastEventReceivedAt = Date.now();
	}
	emitEvent(wrap, evt, relay, fromCache, optimisticPublish) {
		const wrapped = wrap ? wrapEvent3(evt) : evt;
		if (wrapped instanceof Promise) {
			wrapped.then((e) =>
				this.emitEvent(false, e, relay, fromCache, optimisticPublish),
			);
		} else if (wrapped) {
			this.emit("event", wrapped, relay, this, fromCache, optimisticPublish);
		}
	}
	closedReceived(relay, reason) {
		this.emit("closed", relay, reason);
	}
	eoseTimeout;
	eosed = false;
	eoseReceived(relay) {
		this.debug("EOSE received from %s", relay.url);
		this.eosesSeen.add(relay);
		let lastEventSeen = this.lastEventReceivedAt
			? Date.now() - this.lastEventReceivedAt
			: undefined;
		const hasSeenAllEoses = this.eosesSeen.size === this.relayFilters?.size;
		const queryFilled = queryFullyFilled(this);
		const performEose = (reason) => {
			this.debug("Performing EOSE: %s %d", reason, this.eosed);
			if (this.eosed) return;
			if (this.eoseTimeout) clearTimeout(this.eoseTimeout);
			this.emit("eose", this);
			this.eosed = true;
			if (this.opts?.closeOnEose) this.stop();
		};
		if (queryFilled || hasSeenAllEoses) {
			performEose("query filled or seen all");
		} else if (this.relayFilters) {
			let timeToWaitForNextEose = 1000;
			const connectedRelays = new Set(
				this.pool.connectedRelays().map((r) => r.url),
			);
			const connectedRelaysWithFilters = Array.from(
				this.relayFilters.keys(),
			).filter((url) => connectedRelays.has(url));
			if (connectedRelaysWithFilters.length === 0) {
				this.debug(
					"No connected relays, waiting for all relays to connect",
					Array.from(this.relayFilters.keys()).join(", "),
				);
				return;
			}
			const percentageOfRelaysThatHaveSentEose =
				this.eosesSeen.size / connectedRelaysWithFilters.length;
			this.debug("Percentage of relays that have sent EOSE", {
				subId: this.subId,
				percentageOfRelaysThatHaveSentEose,
				seen: this.eosesSeen.size,
				total: connectedRelaysWithFilters.length,
			});
			if (
				this.eosesSeen.size >= 2 &&
				percentageOfRelaysThatHaveSentEose >= 0.5
			) {
				timeToWaitForNextEose =
					timeToWaitForNextEose * (1 - percentageOfRelaysThatHaveSentEose);
				if (timeToWaitForNextEose === 0) {
					performEose("time to wait was 0");
					return;
				}
				if (this.eoseTimeout) clearTimeout(this.eoseTimeout);
				const sendEoseTimeout = () => {
					lastEventSeen = this.lastEventReceivedAt
						? Date.now() - this.lastEventReceivedAt
						: undefined;
					if (lastEventSeen !== undefined && lastEventSeen < 20) {
						this.eoseTimeout = setTimeout(
							sendEoseTimeout,
							timeToWaitForNextEose,
						);
					} else {
						performEose(`send eose timeout: ${timeToWaitForNextEose}`);
					}
				};
				this.eoseTimeout = setTimeout(sendEoseTimeout, timeToWaitForNextEose);
			}
		}
	}
};
var kindIsEphemeral = (kind) => kind >= 20000 && kind < 30000;
async function follows(opts, outbox, kind = 3) {
	if (!this.ndk) throw new Error("NDK not set");
	const contactListEvent = await this.ndk.fetchEvent(
		{ kinds: [kind], authors: [this.pubkey] },
		opts || { groupable: false },
	);
	if (contactListEvent) {
		const pubkeys = /* @__PURE__ */ new Set();
		contactListEvent.tags.forEach((tag) => {
			if (tag[0] === "p") pubkeys.add(tag[1]);
		});
		if (outbox) {
			this.ndk?.outboxTracker?.trackUsers(Array.from(pubkeys));
		}
		return [...pubkeys].reduce((acc, pubkey) => {
			const user = new NDKUser({ pubkey });
			user.ndk = this.ndk;
			acc.add(user);
			return acc;
		}, /* @__PURE__ */ new Set());
	}
	return /* @__PURE__ */ new Set();
}
var NIP05_REGEX2 = /^(?:([\w.+-]+)@)?([\w.-]+)$/;
async function getNip05For(ndk, fullname, _fetch5 = fetch, fetchOpts = {}) {
	return await ndk.queuesNip05.add({
		id: fullname,
		func: async () => {
			if (ndk.cacheAdapter?.loadNip05) {
				const profile = await ndk.cacheAdapter.loadNip05(fullname);
				if (profile !== "missing") {
					if (profile) {
						const user = new NDKUser({
							pubkey: profile.pubkey,
							relayUrls: profile.relays,
							nip46Urls: profile.nip46,
						});
						user.ndk = ndk;
						return user;
					}
					if (fetchOpts.cache !== "no-cache") {
						return null;
					}
				}
			}
			const match = fullname.match(NIP05_REGEX2);
			if (!match) return null;
			const [_, name = "_", domain] = match;
			try {
				const res = await _fetch5(
					`https://${domain}/.well-known/nostr.json?name=${name}`,
					fetchOpts,
				);
				const { names, relays, nip46 } = parseNIP05Result(await res.json());
				const pubkey = names[name.toLowerCase()];
				let profile = null;
				if (pubkey) {
					profile = {
						pubkey,
						relays: relays?.[pubkey],
						nip46: nip46?.[pubkey],
					};
				}
				if (ndk?.cacheAdapter?.saveNip05) {
					ndk.cacheAdapter.saveNip05(fullname, profile);
				}
				return profile;
			} catch (_e) {
				if (ndk?.cacheAdapter?.saveNip05) {
					ndk?.cacheAdapter.saveNip05(fullname, null);
				}
				console.error("Failed to fetch NIP05 for", fullname, _e);
				return null;
			}
		},
	});
}
function parseNIP05Result(json) {
	const result = {
		names: {},
	};
	for (const [name, pubkey] of Object.entries(json.names)) {
		if (typeof name === "string" && typeof pubkey === "string") {
			result.names[name.toLowerCase()] = pubkey;
		}
	}
	if (json.relays) {
		result.relays = {};
		for (const [pubkey, relays] of Object.entries(json.relays)) {
			if (typeof pubkey === "string" && Array.isArray(relays)) {
				result.relays[pubkey] = relays.filter(
					(relay) => typeof relay === "string",
				);
			}
		}
	}
	if (json.nip46) {
		result.nip46 = {};
		for (const [pubkey, nip46] of Object.entries(json.nip46)) {
			if (typeof pubkey === "string" && Array.isArray(nip46)) {
				result.nip46[pubkey] = nip46.filter(
					(relay) => typeof relay === "string",
				);
			}
		}
	}
	return result;
}
function profileFromEvent(event) {
	const profile = {};
	let payload;
	try {
		payload = JSON.parse(event.content);
	} catch (error) {
		throw new Error(`Failed to parse profile event: ${error}`);
	}
	profile.profileEvent = JSON.stringify(event.rawEvent());
	for (const key of Object.keys(payload)) {
		switch (key) {
			case "name":
				profile.name = payload.name;
				break;
			case "display_name":
				profile.displayName = payload.display_name;
				break;
			case "image":
			case "picture":
				profile.picture = payload.picture || payload.image;
				profile.image = profile.picture;
				break;
			case "banner":
				profile.banner = payload.banner;
				break;
			case "bio":
				profile.bio = payload.bio;
				break;
			case "nip05":
				profile.nip05 = payload.nip05;
				break;
			case "lud06":
				profile.lud06 = payload.lud06;
				break;
			case "lud16":
				profile.lud16 = payload.lud16;
				break;
			case "about":
				profile.about = payload.about;
				break;
			case "website":
				profile.website = payload.website;
				break;
			default:
				profile[key] = payload[key];
				break;
		}
	}
	profile.created_at = event.created_at;
	return profile;
}
function serializeProfile(profile) {
	const payload = {};
	for (const [key, val] of Object.entries(profile)) {
		switch (key) {
			case "username":
			case "name":
				payload.name = val;
				break;
			case "displayName":
				payload.display_name = val;
				break;
			case "image":
			case "picture":
				payload.picture = val;
				break;
			case "bio":
			case "about":
				payload.about = val;
				break;
			default:
				payload[key] = val;
				break;
		}
	}
	return JSON.stringify(payload);
}
var NDKUser = class _NDKUser {
	ndk;
	profile;
	profileEvent;
	_npub;
	_pubkey;
	relayUrls = [];
	nip46Urls = [];
	constructor(opts) {
		if (opts.npub) this._npub = opts.npub;
		if (opts.hexpubkey) this._pubkey = opts.hexpubkey;
		if (opts.pubkey) this._pubkey = opts.pubkey;
		if (opts.relayUrls) this.relayUrls = opts.relayUrls;
		if (opts.nip46Urls) this.nip46Urls = opts.nip46Urls;
		if (opts.nprofile) {
			try {
				const decoded = nip19_exports.decode(opts.nprofile);
				if (decoded.type === "nprofile") {
					this._pubkey = decoded.data.pubkey;
					if (decoded.data.relays && decoded.data.relays.length > 0) {
						this.relayUrls.push(...decoded.data.relays);
					}
				}
			} catch (e) {
				console.error("Failed to decode nprofile", e);
			}
		}
	}
	get npub() {
		if (!this._npub) {
			if (!this._pubkey) throw new Error("pubkey not set");
			this._npub = nip19_exports.npubEncode(this.pubkey);
		}
		return this._npub;
	}
	get nprofile() {
		const relays = this.profileEvent?.onRelays?.map((r) => r.url);
		return nip19_exports.nprofileEncode({
			pubkey: this.pubkey,
			relays,
		});
	}
	set npub(npub2) {
		this._npub = npub2;
	}
	get pubkey() {
		if (!this._pubkey) {
			if (!this._npub) throw new Error("npub not set");
			this._pubkey = nip19_exports.decode(this.npub).data;
		}
		return this._pubkey;
	}
	set pubkey(pubkey) {
		this._pubkey = pubkey;
	}
	filter() {
		return { "#p": [this.pubkey] };
	}
	async getZapInfo(timeoutMs) {
		if (!this.ndk) throw new Error("No NDK instance found");
		const promiseWithTimeout = async (promise) => {
			if (!timeoutMs) return promise;
			let timeoutId;
			const timeoutPromise = new Promise((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
			});
			try {
				const result = await Promise.race([promise, timeoutPromise]);
				if (timeoutId) clearTimeout(timeoutId);
				return result;
			} catch (e) {
				if (e instanceof Error && e.message === "Timeout") {
					try {
						const result = await promise;
						return result;
					} catch (_originalError) {
						return;
					}
				}
				return;
			}
		};
		const [userProfile, mintListEvent] = await Promise.all([
			promiseWithTimeout(this.fetchProfile()),
			promiseWithTimeout(
				this.ndk.fetchEvent({ kinds: [10019], authors: [this.pubkey] }),
			),
		]);
		const res = /* @__PURE__ */ new Map();
		if (mintListEvent) {
			const mintList = NDKCashuMintList.from(mintListEvent);
			if (mintList.mints.length > 0) {
				res.set("nip61", {
					mints: mintList.mints,
					relays: mintList.relays,
					p2pk: mintList.p2pk,
				});
			}
		}
		if (userProfile) {
			const { lud06, lud16 } = userProfile;
			res.set("nip57", { lud06, lud16 });
		}
		return res;
	}
	static async fromNip05(nip05Id, ndk, skipCache = false) {
		if (!ndk) throw new Error("No NDK instance found");
		const opts = {};
		if (skipCache) opts.cache = "no-cache";
		const profile = await getNip05For(ndk, nip05Id, ndk?.httpFetch, opts);
		if (profile) {
			const user = new _NDKUser({
				pubkey: profile.pubkey,
				relayUrls: profile.relays,
				nip46Urls: profile.nip46,
			});
			user.ndk = ndk;
			return user;
		}
	}
	async fetchProfile(opts, storeProfileEvent = false) {
		if (!this.ndk) throw new Error("NDK not set");
		let setMetadataEvent = null;
		if (
			this.ndk.cacheAdapter &&
			(this.ndk.cacheAdapter.fetchProfile ||
				this.ndk.cacheAdapter.fetchProfileSync) &&
			opts?.cacheUsage !== "ONLY_RELAY"
		) {
			let profile = null;
			if (this.ndk.cacheAdapter.fetchProfileSync) {
				profile = this.ndk.cacheAdapter.fetchProfileSync(this.pubkey);
			} else if (this.ndk.cacheAdapter.fetchProfile) {
				profile = await this.ndk.cacheAdapter.fetchProfile(this.pubkey);
			}
			if (profile) {
				this.profile = profile;
				return profile;
			}
		}
		opts ??= {};
		opts.cacheUsage ??= "ONLY_RELAY";
		opts.closeOnEose ??= true;
		opts.groupable ??= true;
		opts.groupableDelay ??= 250;
		if (!setMetadataEvent) {
			setMetadataEvent = await this.ndk.fetchEvent(
				{ kinds: [0], authors: [this.pubkey] },
				opts,
			);
		}
		if (!setMetadataEvent) return null;
		this.profile = profileFromEvent(setMetadataEvent);
		if (
			storeProfileEvent &&
			this.profile &&
			this.ndk.cacheAdapter &&
			this.ndk.cacheAdapter.saveProfile
		) {
			this.ndk.cacheAdapter.saveProfile(this.pubkey, this.profile);
		}
		return this.profile;
	}
	follows = follows.bind(this);
	async followSet(opts, outbox, kind = 3) {
		const follows2 = await this.follows(opts, outbox, kind);
		return new Set(Array.from(follows2).map((f) => f.pubkey));
	}
	tagReference() {
		return ["p", this.pubkey];
	}
	referenceTags(marker) {
		const tag = [["p", this.pubkey]];
		if (!marker) return tag;
		tag[0].push("", marker);
		return tag;
	}
	async publish() {
		if (!this.ndk) throw new Error("No NDK instance found");
		if (!this.profile) throw new Error("No profile available");
		this.ndk.assertSigner();
		const event = new NDKEvent(this.ndk, {
			kind: 0,
			content: serializeProfile(this.profile),
		});
		await event.publish();
	}
	async follow(newFollow, currentFollowList, kind = 3) {
		if (!this.ndk) throw new Error("No NDK instance found");
		this.ndk.assertSigner();
		if (!currentFollowList) {
			currentFollowList = await this.follows(undefined, undefined, kind);
		}
		if (currentFollowList.has(newFollow)) {
			return false;
		}
		currentFollowList.add(newFollow);
		const event = new NDKEvent(this.ndk, { kind });
		for (const follow of currentFollowList) {
			event.tag(follow);
		}
		await event.publish();
		return true;
	}
	async unfollow(user, currentFollowList, kind = 3) {
		if (!this.ndk) throw new Error("No NDK instance found");
		this.ndk.assertSigner();
		if (!currentFollowList) {
			currentFollowList = await this.follows(undefined, undefined, kind);
		}
		const newUserFollowList = /* @__PURE__ */ new Set();
		let foundUser = false;
		for (const follow of currentFollowList) {
			if (follow.pubkey !== user.pubkey) {
				newUserFollowList.add(follow);
			} else {
				foundUser = true;
			}
		}
		if (!foundUser) return false;
		const event = new NDKEvent(this.ndk, { kind });
		for (const follow of newUserFollowList) {
			event.tag(follow);
		}
		return await event.publish();
	}
	async validateNip05(nip05Id) {
		if (!this.ndk) throw new Error("No NDK instance found");
		const profilePointer = await getNip05For(this.ndk, nip05Id);
		if (profilePointer === null) return null;
		return profilePointer.pubkey === this.pubkey;
	}
};
var NDKDraft = class _NDKDraft extends NDKEvent {
	_event;
	static kind = 31234;
	static kinds = [31234, 1234];
	counterparty;
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 31234;
	}
	static from(event) {
		return new _NDKDraft(event.ndk, event);
	}
	set identifier(id) {
		this.removeTag("d");
		this.tags.push(["d", id]);
	}
	get identifier() {
		return this.dTag;
	}
	set event(e) {
		if (!(e instanceof NDKEvent)) this._event = new NDKEvent(undefined, e);
		else this._event = e;
		this.prepareEvent();
	}
	set checkpoint(parent) {
		if (parent) {
			this.tags.push(parent.tagReference());
			this.kind = 1234;
		} else {
			this.removeTag("a");
			this.kind = 31234;
		}
	}
	get isCheckpoint() {
		return this.kind === 1234;
	}
	get isProposal() {
		const pTag = this.tagValue("p");
		return !!pTag && pTag !== this.pubkey;
	}
	async getEvent(signer) {
		if (this._event) return this._event;
		signer ??= this.ndk?.signer;
		if (!signer) throw new Error("No signer available");
		if (this.content && this.content.length > 0) {
			try {
				const ownPubkey = signer.pubkey;
				const pubkeys = [this.tagValue("p"), this.pubkey].filter(Boolean);
				const counterpartyPubkey = pubkeys.find(
					(pubkey) => pubkey !== ownPubkey,
				);
				let user;
				user = new NDKUser({ pubkey: counterpartyPubkey ?? ownPubkey });
				await this.decrypt(user, signer);
				const payload = JSON.parse(this.content);
				this._event = await wrapEvent3(new NDKEvent(this.ndk, payload));
				return this._event;
			} catch (e) {
				console.error(e);
				return;
			}
		} else {
			return null;
		}
	}
	prepareEvent() {
		if (!this._event) throw new Error("No event has been provided");
		this.removeTag("k");
		if (this._event.kind) this.tags.push(["k", this._event.kind.toString()]);
		this.content = JSON.stringify(this._event.rawEvent());
	}
	async save({ signer, publish, relaySet }) {
		signer ??= this.ndk?.signer;
		if (!signer) throw new Error("No signer available");
		const user = this.counterparty || (await signer.user());
		await this.encrypt(user, signer);
		if (this.counterparty) {
			const pubkey = this.counterparty.pubkey;
			this.removeTag("p");
			this.tags.push(["p", pubkey]);
		}
		if (publish === false) return;
		return this.publishReplaceable(relaySet);
	}
};
var READ_MARKER = "read";
var WRITE_MARKER = "write";
var NDKRelayList = class _NDKRelayList extends NDKEvent {
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind ??= 10002;
	}
	static from(ndkEvent) {
		return new _NDKRelayList(ndkEvent.ndk, ndkEvent.rawEvent());
	}
	get readRelayUrls() {
		return this.tags
			.filter((tag) => tag[0] === "r" || tag[0] === "relay")
			.filter((tag) => !tag[2] || (tag[2] && tag[2] === READ_MARKER))
			.map((tag) => tryNormalizeRelayUrl(tag[1]))
			.filter((url) => !!url);
	}
	set readRelayUrls(relays) {
		for (const relay of relays) {
			this.tags.push(["r", relay, READ_MARKER]);
		}
	}
	get writeRelayUrls() {
		return this.tags
			.filter((tag) => tag[0] === "r" || tag[0] === "relay")
			.filter((tag) => !tag[2] || (tag[2] && tag[2] === WRITE_MARKER))
			.map((tag) => tryNormalizeRelayUrl(tag[1]))
			.filter((url) => !!url);
	}
	set writeRelayUrls(relays) {
		for (const relay of relays) {
			this.tags.push(["r", relay, WRITE_MARKER]);
		}
	}
	get bothRelayUrls() {
		return this.tags
			.filter((tag) => tag[0] === "r" || tag[0] === "relay")
			.filter((tag) => !tag[2])
			.map((tag) => tag[1]);
	}
	set bothRelayUrls(relays) {
		for (const relay of relays) {
			this.tags.push(["r", relay]);
		}
	}
	get relays() {
		return this.tags
			.filter((tag) => tag[0] === "r" || tag[0] === "relay")
			.map((tag) => tag[1]);
	}
	get relaySet() {
		if (!this.ndk) throw new Error("NDKRelayList has no NDK instance");
		return new NDKRelaySet(
			new Set(
				this.relays.map((u) => this.ndk?.pool.getRelay(u)).filter((r) => !!r),
			),
			this.ndk,
		);
	}
};
function relayListFromKind3(ndk, contactList) {
	try {
		const content = JSON.parse(contactList.content);
		const relayList = new NDKRelayList(ndk);
		const readRelays = /* @__PURE__ */ new Set();
		const writeRelays = /* @__PURE__ */ new Set();
		for (let [key, config] of Object.entries(content)) {
			try {
				key = normalizeRelayUrl(key);
			} catch {
				continue;
			}
			if (!config) {
				readRelays.add(key);
				writeRelays.add(key);
			} else {
				const relayConfig = config;
				if (relayConfig.write) writeRelays.add(key);
				if (relayConfig.read) readRelays.add(key);
			}
		}
		relayList.readRelayUrls = Array.from(readRelays);
		relayList.writeRelayUrls = Array.from(writeRelays);
		return relayList;
	} catch {}
	return;
}
var NDKTask = class _NDKTask extends NDKEvent {
	static kind = 1934;
	static kinds = [1934];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind = 1934;
	}
	static from(event) {
		return new _NDKTask(event.ndk, event.rawEvent());
	}
	set title(value) {
		this.removeTag("title");
		if (value) this.tags.push(["title", value]);
	}
	get title() {
		return this.tagValue("title");
	}
	set project(project) {
		this.removeTag("a");
		this.tags.push(project.tagReference());
	}
	get projectSlug() {
		const tag = this.getMatchingTags("a")[0];
		return tag ? tag[1].split(/:/)?.[2] : undefined;
	}
};
var NDKProjectTemplate = class _NDKProjectTemplate extends NDKEvent {
	static kind = 30717;
	static kinds = [30717];
	constructor(ndk, rawEvent) {
		super(ndk, rawEvent);
		this.kind = 30717;
	}
	static from(event) {
		return new _NDKProjectTemplate(event.ndk, event.rawEvent());
	}
	get templateId() {
		return this.dTag ?? "";
	}
	set templateId(value) {
		this.dTag = value;
	}
	get name() {
		return this.tagValue("title") ?? "";
	}
	set name(value) {
		this.removeTag("title");
		if (value) this.tags.push(["title", value]);
	}
	get description() {
		return this.tagValue("description") ?? "";
	}
	set description(value) {
		this.removeTag("description");
		if (value) this.tags.push(["description", value]);
	}
	get repoUrl() {
		return this.tagValue("uri") ?? "";
	}
	set repoUrl(value) {
		this.removeTag("uri");
		if (value) this.tags.push(["uri", value]);
	}
	get image() {
		return this.tagValue("image");
	}
	set image(value) {
		this.removeTag("image");
		if (value) this.tags.push(["image", value]);
	}
	get command() {
		return this.tagValue("command");
	}
	set command(value) {
		this.removeTag("command");
		if (value) this.tags.push(["command", value]);
	}
	get agentConfig() {
		const agentTag = this.tagValue("agent");
		if (!agentTag) return;
		try {
			return JSON.parse(agentTag);
		} catch {
			return;
		}
	}
	set agentConfig(value) {
		this.removeTag("agent");
		if (value) {
			this.tags.push(["agent", JSON.stringify(value)]);
		}
	}
	get templateTags() {
		return this.getMatchingTags("t")
			.map((tag) => tag[1])
			.filter(Boolean);
	}
	set templateTags(values) {
		this.tags = this.tags.filter((tag) => tag[0] !== "t");
		values.forEach((value) => {
			if (value) this.tags.push(["t", value]);
		});
	}
};
function disconnect(pool, debug9) {
	debug9 ??= import_debug7.default("ndk:relay:auth-policies:disconnect");
	return async (relay) => {
		debug9?.(`Relay ${relay.url} requested authentication, disconnecting`);
		pool.removeRelay(relay.url);
	};
}
async function signAndAuth(event, relay, signer, debug9, resolve, reject) {
	try {
		await event.sign(signer);
		resolve(event);
	} catch (e) {
		debug9?.(`Failed to publish auth event to relay ${relay.url}`, e);
		reject(event);
	}
}
function signIn({ ndk, signer, debug: debug9 } = {}) {
	debug9 ??= import_debug7.default("ndk:auth-policies:signIn");
	return async (relay, challenge3) => {
		debug9?.(`Relay ${relay.url} requested authentication, signing in`);
		const event = new NDKEvent(ndk);
		event.kind = 22242;
		event.tags = [
			["relay", relay.url],
			["challenge", challenge3],
		];
		signer ??= ndk?.signer;
		return new Promise(async (resolve, reject) => {
			if (signer) {
				await signAndAuth(event, relay, signer, debug9, resolve, reject);
			} else {
				ndk?.once("signer:ready", async (signer2) => {
					await signAndAuth(event, relay, signer2, debug9, resolve, reject);
				});
			}
		});
	};
}
var NDKRelayAuthPolicies = {
	disconnect,
	signIn,
};
var NDKNip07Signer = class _NDKNip07Signer {
	_userPromise;
	encryptionQueue = [];
	encryptionProcessing = false;
	debug;
	waitTimeout;
	_pubkey;
	ndk;
	_user;
	constructor(waitTimeout = 1000, ndk) {
		this.debug = import_debug8.default("ndk:nip07");
		this.waitTimeout = waitTimeout;
		this.ndk = ndk;
	}
	get pubkey() {
		if (!this._pubkey) throw new Error("Not ready");
		return this._pubkey;
	}
	async blockUntilReady() {
		await this.waitForExtension();
		const pubkey = await window.nostr?.getPublicKey();
		if (!pubkey) {
			throw new Error("User rejected access");
		}
		this._pubkey = pubkey;
		let user;
		if (this.ndk) user = this.ndk.getUser({ pubkey });
		else user = new NDKUser({ pubkey });
		this._user = user;
		return user;
	}
	async user() {
		if (!this._userPromise) {
			this._userPromise = this.blockUntilReady();
		}
		return this._userPromise;
	}
	get userSync() {
		if (!this._user) throw new Error("User not ready");
		return this._user;
	}
	async sign(event) {
		await this.waitForExtension();
		const signedEvent = await window.nostr?.signEvent(event);
		if (!signedEvent) throw new Error("Failed to sign event");
		return signedEvent.sig;
	}
	async relays(ndk) {
		await this.waitForExtension();
		const relays = (await window.nostr?.getRelays?.()) || {};
		const activeRelays = [];
		for (const url of Object.keys(relays)) {
			if (relays[url].read && relays[url].write) {
				activeRelays.push(url);
			}
		}
		return activeRelays.map(
			(url) => new NDKRelay(url, ndk?.relayAuthDefaultPolicy, ndk),
		);
	}
	async encryptionEnabled(nip) {
		const enabled = [];
		if ((!nip || nip === "nip04") && Boolean(window.nostr?.nip04))
			enabled.push("nip04");
		if ((!nip || nip === "nip44") && Boolean(window.nostr?.nip44))
			enabled.push("nip44");
		return enabled;
	}
	async encrypt(recipient, value, nip = "nip04") {
		if (!(await this.encryptionEnabled(nip)))
			throw new Error(
				`${nip}encryption is not available from your browser extension`,
			);
		await this.waitForExtension();
		const recipientHexPubKey = recipient.pubkey;
		return this.queueEncryption(nip, "encrypt", recipientHexPubKey, value);
	}
	async decrypt(sender, value, nip = "nip04") {
		if (!(await this.encryptionEnabled(nip)))
			throw new Error(
				`${nip}encryption is not available from your browser extension`,
			);
		await this.waitForExtension();
		const senderHexPubKey = sender.pubkey;
		return this.queueEncryption(nip, "decrypt", senderHexPubKey, value);
	}
	async queueEncryption(scheme, method, counterpartyHexpubkey, value) {
		return new Promise((resolve, reject) => {
			this.encryptionQueue.push({
				scheme,
				method,
				counterpartyHexpubkey,
				value,
				resolve,
				reject,
			});
			if (!this.encryptionProcessing) {
				this.processEncryptionQueue();
			}
		});
	}
	async processEncryptionQueue(item, retries = 0) {
		if (!item && this.encryptionQueue.length === 0) {
			this.encryptionProcessing = false;
			return;
		}
		this.encryptionProcessing = true;
		const currentItem = item || this.encryptionQueue.shift();
		if (!currentItem) {
			this.encryptionProcessing = false;
			return;
		}
		const { scheme, method, counterpartyHexpubkey, value, resolve, reject } =
			currentItem;
		this.debug("Processing encryption queue item", {
			method,
			counterpartyHexpubkey,
			value,
		});
		try {
			const result = await window.nostr?.[scheme]?.[method](
				counterpartyHexpubkey,
				value,
			);
			if (!result) throw new Error("Failed to encrypt/decrypt");
			resolve(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("call already executing") && retries < 5) {
				this.debug("Retrying encryption queue item", {
					method,
					counterpartyHexpubkey,
					value,
					retries,
				});
				setTimeout(() => {
					this.processEncryptionQueue(currentItem, retries + 1);
				}, 50 * retries);
				return;
			}
			reject(error instanceof Error ? error : new Error(errorMessage));
		}
		this.processEncryptionQueue();
	}
	waitForExtension() {
		return new Promise((resolve, reject) => {
			if (window.nostr) {
				resolve();
				return;
			}
			let timerId;
			const intervalId = setInterval(() => {
				if (window.nostr) {
					clearTimeout(timerId);
					clearInterval(intervalId);
					resolve();
				}
			}, 100);
			timerId = setTimeout(() => {
				clearInterval(intervalId);
				reject(new Error("NIP-07 extension not available"));
			}, this.waitTimeout);
		});
	}
	toPayload() {
		const payload = {
			type: "nip07",
			payload: "",
		};
		return JSON.stringify(payload);
	}
	static async fromPayload(payloadString, ndk) {
		const payload = JSON.parse(payloadString);
		if (payload.type !== "nip07") {
			throw new Error(
				`Invalid payload type: expected 'nip07', got ${payload.type}`,
			);
		}
		return new _NDKNip07Signer(undefined, ndk);
	}
};
registerSigner("nip07", NDKNip07Signer);
var NDKNostrRpc = class extends import_tseep5.EventEmitter {
	ndk;
	signer;
	relaySet;
	debug;
	encryptionType = "nip04";
	pool;
	constructor(ndk, signer, debug9, relayUrls) {
		super();
		this.ndk = ndk;
		this.signer = signer;
		if (relayUrls) {
			this.pool = new NDKPool(relayUrls, [], ndk, {
				debug: debug9.extend("rpc-pool"),
				name: "Nostr RPC",
			});
			this.relaySet = new NDKRelaySet(
				/* @__PURE__ */ new Set(),
				ndk,
				this.pool,
			);
			for (const url of relayUrls) {
				const relay = this.pool.getRelay(url, false, false);
				relay.authPolicy = NDKRelayAuthPolicies.signIn({
					ndk,
					signer,
					debug: debug9,
				});
				this.relaySet.addRelay(relay);
				relay.connect();
			}
		}
		this.debug = debug9.extend("rpc");
	}
	subscribe(filter) {
		const sub = this.ndk.subscribe(
			filter,
			{
				closeOnEose: false,
				groupable: false,
				cacheUsage: "ONLY_RELAY",
				pool: this.pool,
				relaySet: this.relaySet,
			},
			false,
		);
		sub.on("event", async (event) => {
			try {
				const parsedEvent = await this.parseEvent(event);
				if (parsedEvent.method) {
					this.emit("request", parsedEvent);
				} else {
					this.emit(`response-${parsedEvent.id}`, parsedEvent);
					this.emit("response", parsedEvent);
				}
			} catch (e) {
				this.debug("error parsing event", e, event.rawEvent());
			}
		});
		return new Promise((resolve) => {
			sub.on("eose", () => {
				this.debug("eosed");
				resolve(sub);
			});
			sub.start();
		});
	}
	async parseEvent(event) {
		if (this.encryptionType === "nip44" && event.content.includes("?iv=")) {
			this.encryptionType = "nip04";
		} else if (
			this.encryptionType === "nip04" &&
			!event.content.includes("?iv=")
		) {
			this.encryptionType = "nip44";
		}
		const remoteUser = this.ndk.getUser({ pubkey: event.pubkey });
		remoteUser.ndk = this.ndk;
		let decryptedContent;
		try {
			decryptedContent = await this.signer.decrypt(
				remoteUser,
				event.content,
				this.encryptionType,
			);
		} catch (_e) {
			const otherEncryptionType =
				this.encryptionType === "nip04" ? "nip44" : "nip04";
			decryptedContent = await this.signer.decrypt(
				remoteUser,
				event.content,
				otherEncryptionType,
			);
			this.encryptionType = otherEncryptionType;
		}
		const parsedContent = JSON.parse(decryptedContent);
		const { id, method, params, result, error } = parsedContent;
		if (method) {
			return { id, pubkey: event.pubkey, method, params, event };
		}
		return { id, result, error, event };
	}
	async sendResponse(id, remotePubkey, result, kind = 24133, error) {
		const res = { id, result };
		if (error) {
			res.error = error;
		}
		const localUser = await this.signer.user();
		const remoteUser = this.ndk.getUser({ pubkey: remotePubkey });
		const event = new NDKEvent(this.ndk, {
			kind,
			content: JSON.stringify(res),
			tags: [["p", remotePubkey]],
			pubkey: localUser.pubkey,
		});
		event.content = await this.signer.encrypt(
			remoteUser,
			event.content,
			this.encryptionType,
		);
		await event.sign(this.signer);
		await event.publish(this.relaySet);
	}
	async sendRequest(remotePubkey, method, params = [], kind = 24133, cb) {
		const id = Math.random().toString(36).substring(7);
		const localUser = await this.signer.user();
		const remoteUser = this.ndk.getUser({ pubkey: remotePubkey });
		const request = { id, method, params };
		const promise = new Promise(() => {
			const responseHandler = (response) => {
				if (response.result === "auth_url") {
					this.once(`response-${id}`, responseHandler);
					this.emit("authUrl", response.error);
				} else if (cb) {
					cb(response);
				}
			};
			this.once(`response-${id}`, responseHandler);
		});
		const event = new NDKEvent(this.ndk, {
			kind,
			content: JSON.stringify(request),
			tags: [["p", remotePubkey]],
			pubkey: localUser.pubkey,
		});
		event.content = await this.signer.encrypt(
			remoteUser,
			event.content,
			this.encryptionType,
		);
		await event.sign(this.signer);
		await event.publish(this.relaySet);
		return promise;
	}
};
var ConnectEventHandlingStrategy = class {
	async handle(backend, id, remotePubkey, params) {
		const [_, token] = params;
		const debug9 = backend.debug.extend("connect");
		debug9(`connection request from ${remotePubkey}`);
		if (token && backend.applyToken) {
			debug9("applying token");
			await backend.applyToken(remotePubkey, token);
		}
		if (
			await backend.pubkeyAllowed({
				id,
				pubkey: remotePubkey,
				method: "connect",
				params: token,
			})
		) {
			debug9(`connection request from ${remotePubkey} allowed`);
			return "ack";
		}
		debug9(`connection request from ${remotePubkey} rejected`);
		return;
	}
};
var GetPublicKeyHandlingStrategy = class {
	async handle(backend, _id, _remotePubkey, _params) {
		return backend.localUser?.pubkey;
	}
};
var Nip04DecryptHandlingStrategy = class {
	async handle(backend, id, remotePubkey, params) {
		const [senderPubkey, payload] = params;
		const senderUser = new NDKUser({ pubkey: senderPubkey });
		const decryptedPayload = await decrypt23(
			backend,
			id,
			remotePubkey,
			senderUser,
			payload,
		);
		return decryptedPayload;
	}
};
async function decrypt23(backend, id, remotePubkey, senderUser, payload) {
	if (
		!(await backend.pubkeyAllowed({
			id,
			pubkey: remotePubkey,
			method: "nip04_decrypt",
			params: payload,
		}))
	) {
		backend.debug(`decrypt request from ${remotePubkey} rejected`);
		return;
	}
	return await backend.signer.decrypt(senderUser, payload, "nip04");
}
var Nip04EncryptHandlingStrategy = class {
	async handle(backend, id, remotePubkey, params) {
		const [recipientPubkey, payload] = params;
		const recipientUser = new NDKUser({ pubkey: recipientPubkey });
		const encryptedPayload = await encrypt23(
			backend,
			id,
			remotePubkey,
			recipientUser,
			payload,
		);
		return encryptedPayload;
	}
};
async function encrypt23(backend, id, remotePubkey, recipientUser, payload) {
	if (
		!(await backend.pubkeyAllowed({
			id,
			pubkey: remotePubkey,
			method: "nip04_encrypt",
			params: payload,
		}))
	) {
		backend.debug(`encrypt request from ${remotePubkey} rejected`);
		return;
	}
	return await backend.signer.encrypt(recipientUser, payload, "nip04");
}
var Nip04DecryptHandlingStrategy2 = class {
	async handle(backend, id, remotePubkey, params) {
		const [senderPubkey, payload] = params;
		const senderUser = new NDKUser({ pubkey: senderPubkey });
		const decryptedPayload = await decrypt32(
			backend,
			id,
			remotePubkey,
			senderUser,
			payload,
		);
		return decryptedPayload;
	}
};
async function decrypt32(backend, id, remotePubkey, senderUser, payload) {
	if (
		!(await backend.pubkeyAllowed({
			id,
			pubkey: remotePubkey,
			method: "nip44_decrypt",
			params: payload,
		}))
	) {
		backend.debug(`decrypt request from ${remotePubkey} rejected`);
		return;
	}
	return await backend.signer.decrypt(senderUser, payload, "nip44");
}
var Nip04EncryptHandlingStrategy2 = class {
	async handle(backend, id, remotePubkey, params) {
		const [recipientPubkey, payload] = params;
		const recipientUser = new NDKUser({ pubkey: recipientPubkey });
		const encryptedPayload = await encrypt32(
			backend,
			id,
			remotePubkey,
			recipientUser,
			payload,
		);
		return encryptedPayload;
	}
};
async function encrypt32(backend, id, remotePubkey, recipientUser, payload) {
	if (
		!(await backend.pubkeyAllowed({
			id,
			pubkey: remotePubkey,
			method: "nip44_encrypt",
			params: payload,
		}))
	) {
		backend.debug(`encrypt request from ${remotePubkey} rejected`);
		return;
	}
	return await backend.signer.encrypt(recipientUser, payload, "nip44");
}
var PingEventHandlingStrategy = class {
	async handle(backend, id, remotePubkey, _params) {
		const debug9 = backend.debug.extend("ping");
		debug9(`ping request from ${remotePubkey}`);
		if (
			await backend.pubkeyAllowed({ id, pubkey: remotePubkey, method: "ping" })
		) {
			debug9(`connection request from ${remotePubkey} allowed`);
			return "pong";
		}
		debug9(`connection request from ${remotePubkey} rejected`);
		return;
	}
};
var SignEventHandlingStrategy = class {
	async handle(backend, id, remotePubkey, params) {
		const event = await signEvent(backend, id, remotePubkey, params);
		if (!event) return;
		return JSON.stringify(await event.toNostrEvent());
	}
};
async function signEvent(backend, id, remotePubkey, params) {
	const [eventString] = params;
	backend.debug(`sign event request from ${remotePubkey}`);
	const event = new NDKEvent(backend.ndk, JSON.parse(eventString));
	backend.debug("event to sign", event.rawEvent());
	if (
		!(await backend.pubkeyAllowed({
			id,
			pubkey: remotePubkey,
			method: "sign_event",
			params: event,
		}))
	) {
		backend.debug(`sign event request from ${remotePubkey} rejected`);
		return;
	}
	backend.debug(`sign event request from ${remotePubkey} allowed`);
	await event.sign(backend.signer);
	return event;
}
var NDKNip46Backend = class {
	ndk;
	signer;
	localUser;
	debug;
	rpc;
	permitCallback;
	relayUrls;
	constructor(ndk, privateKeyOrSigner, permitCallback, relayUrls) {
		this.ndk = ndk;
		if (privateKeyOrSigner instanceof Uint8Array) {
			this.signer = new NDKPrivateKeySigner(privateKeyOrSigner);
		} else if (privateKeyOrSigner instanceof String) {
			this.signer = new NDKPrivateKeySigner(hexToBytes3(privateKeyOrSigner));
		} else if (privateKeyOrSigner instanceof NDKPrivateKeySigner) {
			this.signer = privateKeyOrSigner;
		} else {
			throw new Error("Invalid signer");
		}
		this.debug = ndk.debug.extend("nip46:backend");
		this.relayUrls = relayUrls ?? Array.from(ndk.pool.relays.keys());
		this.rpc = new NDKNostrRpc(ndk, this.signer, this.debug, this.relayUrls);
		this.permitCallback = permitCallback;
	}
	async start() {
		this.localUser = await this.signer.user();
		const sub = this.ndk.subscribe(
			{
				kinds: [24133],
				"#p": [this.localUser.pubkey],
			},
			{ closeOnEose: false },
		);
		sub.on("event", (e) => this.handleIncomingEvent(e));
	}
	handlers = {
		connect: new ConnectEventHandlingStrategy(),
		sign_event: new SignEventHandlingStrategy(),
		nip04_encrypt: new Nip04EncryptHandlingStrategy(),
		nip04_decrypt: new Nip04DecryptHandlingStrategy(),
		nip44_encrypt: new Nip04EncryptHandlingStrategy2(),
		nip44_decrypt: new Nip04DecryptHandlingStrategy2(),
		get_public_key: new GetPublicKeyHandlingStrategy(),
		ping: new PingEventHandlingStrategy(),
	};
	setStrategy(method, strategy) {
		this.handlers[method] = strategy;
	}
	async applyToken(_pubkey, _token) {
		throw new Error("connection token not supported");
	}
	async handleIncomingEvent(event) {
		const { id, method, params } = await this.rpc.parseEvent(event);
		const remotePubkey = event.pubkey;
		let response;
		this.debug("incoming event", { id, method, params });
		if (!event.verifySignature(false)) {
			this.debug("invalid signature", event.rawEvent());
			return;
		}
		const strategy = this.handlers[method];
		if (strategy) {
			try {
				response = await strategy.handle(this, id, remotePubkey, params);
			} catch (e) {
				this.debug("error handling event", e, { id, method, params });
				this.rpc.sendResponse(id, remotePubkey, "error", undefined, e.message);
			}
		} else {
			this.debug("unsupported method", { method, params });
		}
		if (response) {
			this.debug(`sending response to ${remotePubkey}`, response);
			this.rpc.sendResponse(id, remotePubkey, response);
		} else {
			this.rpc.sendResponse(
				id,
				remotePubkey,
				"error",
				undefined,
				"Not authorized",
			);
		}
	}
	async pubkeyAllowed(params) {
		return this.permitCallback(params);
	}
};
async function ndkSignerFromPayload(payloadString, ndk) {
	let parsed;
	try {
		parsed = JSON.parse(payloadString);
	} catch (e) {
		console.error("Failed to parse signer payload string", payloadString, e);
		return;
	}
	if (!parsed || typeof parsed.type !== "string") {
		console.error(
			"Failed to parse signer payload string",
			payloadString,
			new Error("Missing type field"),
		);
		return;
	}
	const SignerClass = signerRegistry.get(parsed.type);
	if (!SignerClass) {
		throw new Error(`Unknown signer type: ${parsed.type}`);
	}
	try {
		return await SignerClass.fromPayload(payloadString, ndk);
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		throw new Error(
			`Failed to deserialize signer type ${parsed.type}: ${errorMsg}`,
		);
	}
}
function nostrConnectGenerateSecret() {
	return Math.random().toString(36).substring(2, 15);
}
function generateNostrConnectUri(pubkey, secret, relay, options) {
	const meta = {
		name: options?.name ? encodeURIComponent(options.name) : "",
		url: options?.url ? encodeURIComponent(options.url) : "",
		image: options?.image ? encodeURIComponent(options.image) : "",
		perms: options?.perms ? encodeURIComponent(options.perms) : "",
	};
	let uri = `nostrconnect://${pubkey}?image=${meta.image}&url=${meta.url}&name=${meta.name}&perms=${meta.perms}&secret=${encodeURIComponent(secret)}`;
	if (relay) {
		uri += `&relay=${encodeURIComponent(relay)}`;
	}
	return uri;
}
var NDKNip46Signer = class _NDKNip46Signer extends import_tseep6.EventEmitter {
	ndk;
	_user;
	bunkerPubkey;
	userPubkey;
	get pubkey() {
		if (!this.userPubkey) throw new Error("Not ready");
		return this.userPubkey;
	}
	secret;
	localSigner;
	nip05;
	rpc;
	debug;
	relayUrls;
	subscription;
	nostrConnectUri;
	nostrConnectSecret;
	constructor(
		ndk,
		userOrConnectionToken,
		localSigner,
		relayUrls,
		nostrConnectOptions,
	) {
		super();
		this.ndk = ndk;
		this.debug = ndk.debug.extend("nip46:signer");
		this.relayUrls = relayUrls;
		if (!localSigner) {
			this.localSigner = NDKPrivateKeySigner.generate();
		} else {
			if (typeof localSigner === "string") {
				this.localSigner = new NDKPrivateKeySigner(localSigner);
			} else {
				this.localSigner = localSigner;
			}
		}
		if (userOrConnectionToken === false) {
		} else if (!userOrConnectionToken) {
			this.nostrconnectFlowInit(nostrConnectOptions);
		} else if (userOrConnectionToken.startsWith("bunker://")) {
			this.bunkerFlowInit(userOrConnectionToken);
		} else {
			this.nip05Init(userOrConnectionToken);
		}
		this.rpc = new NDKNostrRpc(
			this.ndk,
			this.localSigner,
			this.debug,
			this.relayUrls,
		);
	}
	static bunker(ndk, userOrConnectionToken, localSigner) {
		return new _NDKNip46Signer(ndk, userOrConnectionToken, localSigner);
	}
	static nostrconnect(ndk, relay, localSigner, nostrConnectOptions) {
		return new _NDKNip46Signer(
			ndk,
			undefined,
			localSigner,
			[relay],
			nostrConnectOptions,
		);
	}
	nostrconnectFlowInit(nostrConnectOptions) {
		this.nostrConnectSecret = nostrConnectGenerateSecret();
		const pubkey = this.localSigner.pubkey;
		this.nostrConnectUri = generateNostrConnectUri(
			pubkey,
			this.nostrConnectSecret,
			this.relayUrls?.[0],
			nostrConnectOptions,
		);
	}
	bunkerFlowInit(connectionToken) {
		const bunkerUrl = new URL(connectionToken);
		const bunkerPubkey =
			bunkerUrl.hostname || bunkerUrl.pathname.replace(/^\/\//, "");
		const userPubkey = bunkerUrl.searchParams.get("pubkey");
		const relayUrls = bunkerUrl.searchParams.getAll("relay");
		const secret = bunkerUrl.searchParams.get("secret");
		this.bunkerPubkey = bunkerPubkey;
		this.userPubkey = userPubkey;
		this.relayUrls = relayUrls;
		this.secret = secret;
	}
	nip05Init(nip05) {
		this.nip05 = nip05;
	}
	async startListening() {
		if (this.subscription) return;
		const localUser = await this.localSigner.user();
		if (!localUser) throw new Error("Local signer not ready");
		this.subscription = await this.rpc.subscribe({
			kinds: [24133],
			"#p": [localUser.pubkey],
		});
	}
	async user() {
		if (this._user) return this._user;
		return this.blockUntilReady();
	}
	get userSync() {
		if (!this._user) throw new Error("Remote user not ready synchronously");
		return this._user;
	}
	async blockUntilReadyNostrConnect() {
		return new Promise((resolve, reject) => {
			const connect = (response) => {
				if (response.result === this.nostrConnectSecret) {
					this._user = response.event.author;
					this.userPubkey = response.event.pubkey;
					this.bunkerPubkey = response.event.pubkey;
					this.rpc.off("response", connect);
					resolve(this._user);
				}
			};
			this.startListening();
			this.rpc.on("response", connect);
		});
	}
	async blockUntilReady() {
		if (!this.bunkerPubkey && !this.nostrConnectSecret && !this.nip05) {
			throw new Error("Bunker pubkey not set");
		}
		if (this.nostrConnectSecret) return this.blockUntilReadyNostrConnect();
		if (this.nip05 && !this.userPubkey) {
			const user = await NDKUser.fromNip05(this.nip05, this.ndk);
			if (user) {
				this._user = user;
				this.userPubkey = user.pubkey;
				this.relayUrls = user.nip46Urls;
				this.rpc = new NDKNostrRpc(
					this.ndk,
					this.localSigner,
					this.debug,
					this.relayUrls,
				);
			}
		}
		if (!this.bunkerPubkey && this.userPubkey) {
			this.bunkerPubkey = this.userPubkey;
		} else if (!this.bunkerPubkey) {
			throw new Error("Bunker pubkey not set");
		}
		await this.startListening();
		this.rpc.on("authUrl", (...props) => {
			this.emit("authUrl", ...props);
		});
		return new Promise((resolve, reject) => {
			const connectParams = [this.userPubkey ?? ""];
			if (this.secret) connectParams.push(this.secret);
			if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
			this.rpc.sendRequest(
				this.bunkerPubkey,
				"connect",
				connectParams,
				24133,
				(response) => {
					if (response.result === "ack") {
						this.getPublicKey().then((pubkey) => {
							this.userPubkey = pubkey;
							this._user = this.ndk.getUser({ pubkey });
							resolve(this._user);
						});
					} else {
						reject(response.error);
					}
				},
			);
		});
	}
	stop() {
		this.subscription?.stop();
		this.subscription = undefined;
	}
	async getPublicKey() {
		if (this.userPubkey) return this.userPubkey;
		return new Promise((resolve, _reject) => {
			if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
			this.rpc.sendRequest(
				this.bunkerPubkey,
				"get_public_key",
				[],
				24133,
				(response) => {
					resolve(response.result);
				},
			);
		});
	}
	async encryptionEnabled(scheme) {
		if (scheme) return [scheme];
		return Promise.resolve(["nip04", "nip44"]);
	}
	async encrypt(recipient, value, scheme = "nip04") {
		return this.encryption(recipient, value, scheme, "encrypt");
	}
	async decrypt(sender, value, scheme = "nip04") {
		return this.encryption(sender, value, scheme, "decrypt");
	}
	async encryption(peer, value, scheme, method) {
		const promise = new Promise((resolve, reject) => {
			if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
			this.rpc.sendRequest(
				this.bunkerPubkey,
				`${scheme}_${method}`,
				[peer.pubkey, value],
				24133,
				(response) => {
					if (!response.error) {
						resolve(response.result);
					} else {
						reject(response.error);
					}
				},
			);
		});
		return promise;
	}
	async sign(event) {
		const promise = new Promise((resolve, reject) => {
			if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
			this.rpc.sendRequest(
				this.bunkerPubkey,
				"sign_event",
				[JSON.stringify(event)],
				24133,
				(response) => {
					if (!response.error) {
						const json = JSON.parse(response.result);
						resolve(json.sig);
					} else {
						reject(response.error);
					}
				},
			);
		});
		return promise;
	}
	async createAccount(username, domain, email) {
		await this.startListening();
		const req = [];
		if (username) req.push(username);
		if (domain) req.push(domain);
		if (email) req.push(email);
		return new Promise((resolve, reject) => {
			if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
			this.rpc.sendRequest(
				this.bunkerPubkey,
				"create_account",
				req,
				24133,
				(response) => {
					if (!response.error) {
						const pubkey = response.result;
						resolve(pubkey);
					} else {
						reject(response.error);
					}
				},
			);
		});
	}
	toPayload() {
		if (!this.bunkerPubkey || !this.userPubkey) {
			throw new Error(
				"NIP-46 signer is not fully initialized for serialization",
			);
		}
		const payload = {
			type: "nip46",
			payload: {
				bunkerPubkey: this.bunkerPubkey,
				userPubkey: this.userPubkey,
				relayUrls: this.relayUrls,
				secret: this.secret,
				localSignerPayload: this.localSigner.toPayload(),
				nip05: this.nip05 || null,
			},
		};
		return JSON.stringify(payload);
	}
	static async fromPayload(payloadString, ndk) {
		if (!ndk) {
			throw new Error("NDK instance is required to deserialize NIP-46 signer");
		}
		const parsed = JSON.parse(payloadString);
		if (parsed.type !== "nip46") {
			throw new Error(
				`Invalid payload type: expected 'nip46', got ${parsed.type}`,
			);
		}
		const payload = parsed.payload;
		if (
			!payload ||
			typeof payload !== "object" ||
			!payload.localSignerPayload
		) {
			throw new Error("Invalid payload content for nip46 signer");
		}
		const localSigner = await ndkSignerFromPayload(
			payload.localSignerPayload,
			ndk,
		);
		if (!localSigner) {
			throw new Error("Failed to deserialize local signer for NIP-46");
		}
		if (!(localSigner instanceof NDKPrivateKeySigner)) {
			throw new Error(
				"Local signer must be an instance of NDKPrivateKeySigner",
			);
		}
		let signer;
		signer = new _NDKNip46Signer(ndk, false, localSigner, payload.relayUrls);
		signer.userPubkey = payload.userPubkey;
		signer.bunkerPubkey = payload.bunkerPubkey;
		signer.relayUrls = payload.relayUrls;
		signer.secret = payload.secret;
		if (payload.userPubkey) {
			signer._user = new NDKUser({ pubkey: payload.userPubkey });
			if (signer._user) signer._user.ndk = ndk;
		}
		return signer;
	}
};
registerSigner("nip46", NDKNip46Signer);
function dedup(event1, event2) {
	if (event1.created_at > event2.created_at) {
		return event1;
	}
	return event2;
}
async function getRelayListForUser(pubkey, ndk) {
	const list = await getRelayListForUsers([pubkey], ndk);
	return list.get(pubkey);
}
async function getRelayListForUsers(
	pubkeys,
	ndk,
	skipCache = false,
	timeout = 1000,
) {
	const pool = ndk.outboxPool || ndk.pool;
	const set = /* @__PURE__ */ new Set();
	for (const relay of pool.relays.values()) set.add(relay);
	const relayLists = /* @__PURE__ */ new Map();
	const fromContactList = /* @__PURE__ */ new Map();
	const relaySet = new NDKRelaySet(set, ndk);
	if (ndk.cacheAdapter?.locking && !skipCache) {
		const cachedList = await ndk.fetchEvents(
			{ kinds: [3, 10002], authors: Array.from(new Set(pubkeys)) },
			{ cacheUsage: "ONLY_CACHE", subId: "ndk-relay-list-fetch" },
		);
		for (const relayList of cachedList) {
			if (relayList.kind === 10002)
				relayLists.set(relayList.pubkey, NDKRelayList.from(relayList));
		}
		for (const relayList of cachedList) {
			if (relayList.kind === 3) {
				if (relayLists.has(relayList.pubkey)) continue;
				const list = relayListFromKind3(ndk, relayList);
				if (list) fromContactList.set(relayList.pubkey, list);
			}
		}
		pubkeys = pubkeys.filter(
			(pubkey) => !relayLists.has(pubkey) && !fromContactList.has(pubkey),
		);
	}
	if (pubkeys.length === 0) return relayLists;
	const relayListEvents = /* @__PURE__ */ new Map();
	const contactListEvents = /* @__PURE__ */ new Map();
	return new Promise((resolve) => {
		const handleSubscription = async () => {
			const subscribeOpts = {
				closeOnEose: true,
				pool,
				groupable: true,
				subId: "ndk-relay-list-fetch",
				addSinceFromCache: true,
				relaySet,
			};
			if (relaySet) subscribeOpts.relaySet = relaySet;
			ndk.subscribe({ kinds: [3, 10002], authors: pubkeys }, subscribeOpts, {
				onEvent: (event) => {
					if (event.kind === 10002) {
						const existingEvent = relayListEvents.get(event.pubkey);
						if (existingEvent && existingEvent.created_at > event.created_at)
							return;
						relayListEvents.set(event.pubkey, event);
					} else if (event.kind === 3) {
						const existingEvent = contactListEvents.get(event.pubkey);
						if (existingEvent && existingEvent.created_at > event.created_at)
							return;
						contactListEvents.set(event.pubkey, event);
					}
				},
				onEose: () => {
					for (const event of relayListEvents.values()) {
						relayLists.set(event.pubkey, NDKRelayList.from(event));
					}
					for (const pubkey of pubkeys) {
						if (relayLists.has(pubkey)) continue;
						const contactList = contactListEvents.get(pubkey);
						if (!contactList) continue;
						const list = relayListFromKind3(ndk, contactList);
						if (list) relayLists.set(pubkey, list);
					}
					resolve(relayLists);
				},
			});
			setTimeout(() => {
				resolve(relayLists);
			}, timeout);
		};
		handleSubscription();
	});
}
var OutboxItem = class {
	type;
	relayUrlScores;
	readRelays;
	writeRelays;
	constructor(type) {
		this.type = type;
		this.relayUrlScores = /* @__PURE__ */ new Map();
		this.readRelays = /* @__PURE__ */ new Set();
		this.writeRelays = /* @__PURE__ */ new Set();
	}
};
var OutboxTracker = class extends import_tseep8.EventEmitter {
	data;
	ndk;
	debug;
	constructor(ndk) {
		super();
		this.ndk = ndk;
		this.debug = ndk.debug.extend("outbox-tracker");
		this.data = new import_typescript_lru_cache2.LRUCache({
			maxSize: 1e5,
			entryExpirationTimeInMS: 2 * 60 * 1000,
		});
	}
	async trackUsers(items, skipCache = false) {
		const promises = [];
		for (let i2 = 0; i2 < items.length; i2 += 400) {
			const slice = items.slice(i2, i2 + 400);
			const pubkeys = slice
				.map((item) => getKeyFromItem(item))
				.filter((pubkey) => !this.data.has(pubkey));
			if (pubkeys.length === 0) continue;
			for (const pubkey of pubkeys) {
				this.data.set(pubkey, new OutboxItem("user"));
			}
			promises.push(
				new Promise((resolve) => {
					getRelayListForUsers(pubkeys, this.ndk, skipCache)
						.then((relayLists) => {
							for (const [pubkey, relayList] of relayLists) {
								let outboxItem = this.data.get(pubkey);
								outboxItem ??= new OutboxItem("user");
								if (relayList) {
									outboxItem.readRelays = new Set(
										normalize2(relayList.readRelayUrls),
									);
									outboxItem.writeRelays = new Set(
										normalize2(relayList.writeRelayUrls),
									);
									for (const relayUrl of outboxItem.readRelays) {
										if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
											outboxItem.readRelays.delete(relayUrl);
										}
									}
									for (const relayUrl of outboxItem.writeRelays) {
										if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
											outboxItem.writeRelays.delete(relayUrl);
										}
									}
									this.data.set(pubkey, outboxItem);
								}
							}
						})
						.finally(resolve);
				}),
			);
		}
		return Promise.all(promises);
	}
	track(item, type, _skipCache = true) {
		const key = getKeyFromItem(item);
		type ??= getTypeFromItem(item);
		let outboxItem = this.data.get(key);
		if (!outboxItem) {
			outboxItem = new OutboxItem(type);
			if (item instanceof NDKUser) {
				this.trackUsers([item]);
			}
		}
		return outboxItem;
	}
};
function getKeyFromItem(item) {
	if (item instanceof NDKUser) {
		return item.pubkey;
	}
	return item;
}
function getTypeFromItem(item) {
	if (item instanceof NDKUser) {
		return "user";
	}
	return "kind";
}
function correctRelaySet(relaySet, pool) {
	const connectedRelays = pool.connectedRelays();
	const includesConnectedRelay = Array.from(relaySet.relays).some((relay) => {
		return connectedRelays.map((r) => r.url).includes(relay.url);
	});
	if (!includesConnectedRelay) {
		for (const relay of connectedRelays) {
			relaySet.addRelay(relay);
		}
	}
	if (connectedRelays.length === 0) {
		for (const relay of pool.relays.values()) {
			relaySet.addRelay(relay);
		}
	}
	return relaySet;
}
var NDKSubscriptionManager = class {
	subscriptions;
	seenEvents = /* @__PURE__ */ new Map();
	constructor() {
		this.subscriptions = /* @__PURE__ */ new Map();
	}
	add(sub) {
		this.subscriptions.set(sub.internalId, sub);
		if (sub.onStopped) {
		}
		sub.onStopped = () => {
			this.subscriptions.delete(sub.internalId);
		};
		sub.on("close", () => {
			this.subscriptions.delete(sub.internalId);
		});
	}
	seenEvent(eventId, relay) {
		const current = this.seenEvents.get(eventId) || [];
		current.push(relay);
		this.seenEvents.set(eventId, current);
	}
	dispatchEvent(event, relay, optimisticPublish = false) {
		if (relay) this.seenEvent(event.id, relay);
		const subscriptions = this.subscriptions.values();
		const matchingSubs = [];
		for (const sub of subscriptions) {
			if (matchFilters(sub.filters, event)) {
				matchingSubs.push(sub);
			}
		}
		for (const sub of matchingSubs) {
			sub.eventReceived(event, relay, false, optimisticPublish);
		}
	}
};
var debug7 = import_debug10.default("ndk:active-user");
async function getUserRelayList(user) {
	if (!this.autoConnectUserRelays) return;
	const userRelays = await getRelayListForUser(user.pubkey, this);
	if (!userRelays) return;
	for (const url of userRelays.relays) {
		let relay = this.pool.relays.get(url);
		if (!relay) {
			relay = new NDKRelay(url, this.relayAuthDefaultPolicy, this);
			this.pool.addRelay(relay);
		}
	}
	return userRelays;
}
async function setActiveUser(user) {
	const pool = this.outboxPool || this.pool;
	if (pool.connectedRelays.length > 0) {
		setActiveUserConnected.call(this, user);
	} else {
		pool.once("connect", () => {
			setActiveUserConnected.call(this, user);
		});
	}
}
async function setActiveUserConnected(user) {
	const userRelays = await getUserRelayList.call(this, user);
	const filters = [
		{
			kinds: [10006],
			authors: [user.pubkey],
		},
	];
	if (this.autoFetchUserMutelist) {
		filters[0].kinds?.push(1e4);
	}
	const events = /* @__PURE__ */ new Map();
	const relaySet = userRelays ? userRelays.relaySet : undefined;
	this.subscribe(
		filters,
		{ subId: "active-user-settings", closeOnEose: true, relaySet },
		{
			onEvent: (event) => {
				const prevEvent = events.get(event.kind);
				if (prevEvent && prevEvent.created_at >= event.created_at) return;
				events.set(event.kind, event);
			},
			onEose: () => {
				for (const event of events.values()) {
					processEvent.call(this, event);
				}
			},
		},
	);
}
async function processEvent(event) {
	if (event.kind === 10006) {
		processBlockRelayList.call(this, event);
	} else if (event.kind === 1e4) {
		processMuteList.call(this, event);
	}
}
function processBlockRelayList(event) {
	const list = lists_default.from(event);
	for (const item of list.items) {
		this.pool.blacklistRelayUrls.add(item[0]);
	}
	debug7("Added %d relays to relay blacklist", list.items.length);
}
function processMuteList(muteList) {
	const list = lists_default.from(muteList);
	for (const item of list.items) {
		this.mutedIds.set(item[1], item[0]);
	}
	debug7("Added %d users to mute list", list.items.length);
}
function getEntity(entity) {
	try {
		const decoded = nip19_exports.decode(entity);
		if (decoded.type === "npub") return npub(this, decoded.data);
		if (decoded.type === "nprofile") return nprofile(this, decoded.data);
		return decoded;
	} catch (_e) {
		return null;
	}
}
function npub(ndk, pubkey) {
	return ndk.getUser({ pubkey });
}
function nprofile(ndk, profile) {
	const user = ndk.getUser({ pubkey: profile.pubkey });
	if (profile.relays) user.relayUrls = profile.relays;
	return user;
}
function isValidHint(hint) {
	if (!hint || hint === "") return false;
	try {
		new URL(hint);
		return true;
	} catch (_e) {
		return false;
	}
}
async function fetchEventFromTag(
	tag,
	originalEvent,
	subOpts,
	fallback = {
		type: "timeout",
	},
) {
	const d4 = this.debug.extend("fetch-event-from-tag");
	const [_, id, hint] = tag;
	subOpts = {};
	d4("fetching event from tag", tag, subOpts, fallback);
	const authorRelays = getRelaysForSync(this, originalEvent.pubkey);
	if (authorRelays && authorRelays.size > 0) {
		d4("fetching event from author relays %o", Array.from(authorRelays));
		const relaySet2 = NDKRelaySet.fromRelayUrls(Array.from(authorRelays), this);
		const event2 = await this.fetchEvent(id, subOpts, relaySet2);
		if (event2) return event2;
	} else {
		d4("no author relays found for %s", originalEvent.pubkey, originalEvent);
	}
	const relaySet = calculateRelaySetsFromFilters(
		this,
		[{ ids: [id] }],
		this.pool,
	);
	d4("fetching event without relay hint", relaySet);
	const event = await this.fetchEvent(id, subOpts);
	if (event) return event;
	if (hint && hint !== "") {
		const event2 = await this.fetchEvent(
			id,
			subOpts,
			this.pool.getRelay(hint, true, true, [{ ids: [id] }]),
		);
		if (event2) return event2;
	}
	let result = undefined;
	const relay = isValidHint(hint)
		? this.pool.getRelay(hint, false, true, [{ ids: [id] }])
		: undefined;
	const fetchMaybeWithRelayHint = new Promise((resolve) => {
		this.fetchEvent(id, subOpts, relay).then(resolve);
	});
	if (!isValidHint(hint) || fallback.type === "none") {
		return fetchMaybeWithRelayHint;
	}
	const fallbackFetchPromise = new Promise(async (resolve) => {
		const fallbackRelaySet = fallback.relaySet;
		const timeout = fallback.timeout ?? 1500;
		const timeoutPromise = new Promise((resolve2) =>
			setTimeout(resolve2, timeout),
		);
		if (fallback.type === "timeout") await timeoutPromise;
		if (result) {
			resolve(result);
		} else {
			d4("fallback fetch triggered");
			const fallbackEvent = await this.fetchEvent(
				id,
				subOpts,
				fallbackRelaySet,
			);
			resolve(fallbackEvent);
		}
	});
	switch (fallback.type) {
		case "timeout":
			return Promise.race([fetchMaybeWithRelayHint, fallbackFetchPromise]);
		case "eose":
			result = await fetchMaybeWithRelayHint;
			if (result) return result;
			return fallbackFetchPromise;
	}
}
var Queue2 = class {
	queue = [];
	maxConcurrency;
	processing = /* @__PURE__ */ new Set();
	promises = /* @__PURE__ */ new Map();
	constructor(_name, maxConcurrency) {
		this.maxConcurrency = maxConcurrency;
	}
	add(item) {
		if (this.promises.has(item.id)) {
			return this.promises.get(item.id);
		}
		const promise = new Promise((resolve, reject) => {
			this.queue.push({
				...item,
				func: () =>
					item.func().then(
						(result) => {
							resolve(result);
							return result;
						},
						(error) => {
							reject(error);
							throw error;
						},
					),
			});
			this.process();
		});
		this.promises.set(item.id, promise);
		promise.finally(() => {
			this.promises.delete(item.id);
			this.processing.delete(item.id);
			this.process();
		});
		return promise;
	}
	process() {
		if (
			this.processing.size >= this.maxConcurrency ||
			this.queue.length === 0
		) {
			return;
		}
		const item = this.queue.shift();
		if (!item || this.processing.has(item.id)) {
			return;
		}
		this.processing.add(item.id);
		item.func();
	}
	clear() {
		this.queue = [];
	}
	clearProcessing() {
		this.processing.clear();
	}
	clearAll() {
		this.clear();
		this.clearProcessing();
	}
	length() {
		return this.queue.length;
	}
};
var DEFAULT_OUTBOX_RELAYS = ["wss://purplepag.es/", "wss://nos.lol/"];
var DEFAULT_BLACKLISTED_RELAYS = [
	"wss://brb.io/",
	"wss://nostr.mutinywallet.com/",
];
var NDK = class extends import_tseep7.EventEmitter {
	_explicitRelayUrls;
	blacklistRelayUrls;
	pool;
	outboxPool;
	_signer;
	_activeUser;
	cacheAdapter;
	debug;
	devWriteRelaySet;
	outboxTracker;
	mutedIds;
	clientName;
	clientNip89;
	queuesZapConfig;
	queuesNip05;
	asyncSigVerification = false;
	initialValidationRatio = 1;
	lowestValidationRatio = 0.1;
	validationRatioFn;
	autoBlacklistInvalidRelays = false;
	subManager;
	_signatureVerificationFunction;
	_signatureVerificationWorker;
	signatureVerificationTimeMs = 0;
	publishingFailureHandled = false;
	pools = [];
	relayAuthDefaultPolicy;
	httpFetch;
	netDebug;
	autoConnectUserRelays = true;
	autoFetchUserMutelist = true;
	walletConfig;
	constructor(opts = {}) {
		super();
		this.debug = opts.debug || import_debug9.default("ndk");
		this.netDebug = opts.netDebug;
		this._explicitRelayUrls = opts.explicitRelayUrls || [];
		this.blacklistRelayUrls =
			opts.blacklistRelayUrls || DEFAULT_BLACKLISTED_RELAYS;
		this.subManager = new NDKSubscriptionManager();
		this.pool = new NDKPool(opts.explicitRelayUrls || [], [], this);
		this.pool.name = "Main";
		this.pool.on("relay:auth", async (relay, challenge3) => {
			if (this.relayAuthDefaultPolicy) {
				await this.relayAuthDefaultPolicy(relay, challenge3);
			}
		});
		this.autoConnectUserRelays = opts.autoConnectUserRelays ?? true;
		this.autoFetchUserMutelist = opts.autoFetchUserMutelist ?? true;
		this.clientName = opts.clientName;
		this.clientNip89 = opts.clientNip89;
		this.relayAuthDefaultPolicy = opts.relayAuthDefaultPolicy;
		if (opts.enableOutboxModel) {
			this.outboxPool = new NDKPool(
				opts.outboxRelayUrls || DEFAULT_OUTBOX_RELAYS,
				[],
				this,
				{
					debug: this.debug.extend("outbox-pool"),
					name: "Outbox Pool",
				},
			);
			this.outboxTracker = new OutboxTracker(this);
		}
		this.signer = opts.signer;
		this.cacheAdapter = opts.cacheAdapter;
		this.mutedIds = opts.mutedIds || /* @__PURE__ */ new Map();
		if (opts.devWriteRelayUrls) {
			this.devWriteRelaySet = NDKRelaySet.fromRelayUrls(
				opts.devWriteRelayUrls,
				this,
			);
		}
		this.queuesZapConfig = new Queue2("zaps", 3);
		this.queuesNip05 = new Queue2("nip05", 10);
		if (opts.signatureVerificationWorker) {
			this.signatureVerificationWorker = opts.signatureVerificationWorker;
		}
		if (opts.signatureVerificationFunction) {
			this.signatureVerificationFunction = opts.signatureVerificationFunction;
		}
		this.initialValidationRatio = opts.initialValidationRatio || 1;
		this.lowestValidationRatio = opts.lowestValidationRatio || 0.1;
		this.autoBlacklistInvalidRelays = opts.autoBlacklistInvalidRelays || false;
		this.validationRatioFn =
			opts.validationRatioFn || this.defaultValidationRatioFn;
		try {
			this.httpFetch = fetch;
		} catch {}
	}
	set explicitRelayUrls(urls) {
		this._explicitRelayUrls = urls.map(normalizeRelayUrl);
		this.pool.relayUrls = urls;
	}
	get explicitRelayUrls() {
		return this._explicitRelayUrls || [];
	}
	set signatureVerificationWorker(worker2) {
		this._signatureVerificationWorker = worker2;
		if (worker2) {
			signatureVerificationInit(worker2);
			this.asyncSigVerification = true;
		} else {
			this.asyncSigVerification = false;
		}
	}
	set signatureVerificationFunction(fn) {
		this._signatureVerificationFunction = fn;
		this.asyncSigVerification = !!fn;
	}
	get signatureVerificationFunction() {
		return this._signatureVerificationFunction;
	}
	addExplicitRelay(urlOrRelay, relayAuthPolicy, connect = true) {
		let relay;
		if (typeof urlOrRelay === "string") {
			relay = new NDKRelay(urlOrRelay, relayAuthPolicy, this);
		} else {
			relay = urlOrRelay;
		}
		this.pool.addRelay(relay, connect);
		this.explicitRelayUrls?.push(relay.url);
		return relay;
	}
	toJSON() {
		return { relayCount: this.pool.relays.size }.toString();
	}
	get activeUser() {
		return this._activeUser;
	}
	set activeUser(user) {
		const differentUser = this._activeUser?.pubkey !== user?.pubkey;
		this._activeUser = user;
		if (user && differentUser) {
			setActiveUser.call(this, user);
		} else if (!user) {
			this.mutedIds = /* @__PURE__ */ new Map();
		}
	}
	get signer() {
		return this._signer;
	}
	set signer(newSigner) {
		this._signer = newSigner;
		if (newSigner) this.emit("signer:ready", newSigner);
		newSigner?.user().then((user) => {
			user.ndk = this;
			this.activeUser = user;
		});
	}
	async connect(timeoutMs) {
		if (this._signer && this.autoConnectUserRelays) {
			this.debug(
				"Attempting to connect to user relays specified by signer %o",
				await this._signer.relays?.(this),
			);
			if (this._signer.relays) {
				const relays = await this._signer.relays(this);
				relays.forEach((relay) => this.pool.addRelay(relay));
			}
		}
		const connections = [this.pool.connect(timeoutMs)];
		if (this.outboxPool) {
			connections.push(this.outboxPool.connect(timeoutMs));
		}
		return Promise.allSettled(connections).then(() => {});
	}
	reportInvalidSignature(event, relay) {
		this.debug(
			`Invalid signature detected for event ${event.id}${relay ? ` from relay ${relay.url}` : ""}`,
		);
		this.emit("event:invalid-sig", event, relay);
		if (this.autoBlacklistInvalidRelays && relay) {
			this.blacklistRelay(relay.url);
		}
	}
	blacklistRelay(url) {
		if (!this.blacklistRelayUrls) {
			this.blacklistRelayUrls = [];
		}
		if (!this.blacklistRelayUrls.includes(url)) {
			this.blacklistRelayUrls.push(url);
			this.debug(`Added relay to blacklist: ${url}`);
			const relay = this.pool.getRelay(url, false, false);
			if (relay) {
				relay.disconnect();
				this.debug(`Disconnected from blacklisted relay: ${url}`);
			}
		}
	}
	defaultValidationRatioFn(relay, validatedCount, nonValidatedCount) {
		if (validatedCount < 10) return this.initialValidationRatio;
		const trustFactor = Math.min(validatedCount / 100, 1);
		const calculatedRatio =
			this.initialValidationRatio * (1 - trustFactor) +
			this.lowestValidationRatio * trustFactor;
		return Math.max(calculatedRatio, this.lowestValidationRatio);
	}
	getUser(opts) {
		const user = new NDKUser(opts);
		user.ndk = this;
		return user;
	}
	async getUserFromNip05(nip05, skipCache = false) {
		return NDKUser.fromNip05(nip05, this, skipCache);
	}
	subscribe(filters, opts, autoStartOrRelaySet = true, _autoStart = true) {
		let _relaySet = opts?.relaySet;
		let autoStart = _autoStart;
		if (autoStartOrRelaySet instanceof NDKRelaySet) {
			console.warn(
				"relaySet is deprecated, use opts.relaySet instead. This will be removed in version v2.14.0",
			);
			_relaySet = autoStartOrRelaySet;
			autoStart = _autoStart;
		} else if (
			typeof autoStartOrRelaySet === "boolean" ||
			typeof autoStartOrRelaySet === "object"
		) {
			autoStart = autoStartOrRelaySet;
		}
		const subscription = new NDKSubscription(this, filters, {
			relaySet: _relaySet,
			...opts,
		});
		this.subManager.add(subscription);
		const pool = subscription.pool;
		if (subscription.relaySet) {
			for (const relay of subscription.relaySet.relays) {
				pool.useTemporaryRelay(relay, undefined, subscription.filters);
			}
		}
		if (this.outboxPool && subscription.hasAuthorsFilter()) {
			const authors = subscription.filters
				.filter((filter) => filter.authors && filter.authors?.length > 0)
				.flatMap((filter) => filter.authors);
			this.outboxTracker?.trackUsers(authors);
		}
		if (autoStart) {
			let eventsHandler;
			if (typeof autoStart === "object") {
				if (autoStart.onEvent) subscription.on("event", autoStart.onEvent);
				if (autoStart.onEose) subscription.on("eose", autoStart.onEose);
				if (autoStart.onEvents) eventsHandler = autoStart.onEvents;
			}
			setTimeout(() => {
				const cachedEvents = subscription.start(!eventsHandler);
				if (cachedEvents && cachedEvents.length > 0 && !!eventsHandler)
					eventsHandler(cachedEvents);
			}, 0);
		}
		return subscription;
	}
	fetchEventFromTag = fetchEventFromTag.bind(this);
	fetchEventSync(idOrFilter) {
		if (!this.cacheAdapter) throw new Error("Cache adapter not set");
		let filters;
		if (typeof idOrFilter === "string") filters = [filterFromId(idOrFilter)];
		else filters = idOrFilter;
		const sub = new NDKSubscription(this, filters);
		const events = this.cacheAdapter.query(sub);
		if (events instanceof Promise) throw new Error("Cache adapter is async");
		return events.map((e) => {
			e.ndk = this;
			return e;
		});
	}
	async fetchEvent(idOrFilter, opts, relaySetOrRelay) {
		let filters;
		let relaySet;
		if (relaySetOrRelay instanceof NDKRelay) {
			relaySet = new NDKRelaySet(
				/* @__PURE__ */ new Set([relaySetOrRelay]),
				this,
			);
		} else if (relaySetOrRelay instanceof NDKRelaySet) {
			relaySet = relaySetOrRelay;
		}
		if (!relaySetOrRelay && typeof idOrFilter === "string") {
			if (!isNip33AValue(idOrFilter)) {
				const relays = relaysFromBech32(idOrFilter, this);
				if (relays.length > 0) {
					relaySet = new NDKRelaySet(new Set(relays), this);
					relaySet = correctRelaySet(relaySet, this.pool);
				}
			}
		}
		if (typeof idOrFilter === "string") {
			filters = [filterFromId(idOrFilter)];
		} else if (Array.isArray(idOrFilter)) {
			filters = idOrFilter;
		} else {
			filters = [idOrFilter];
		}
		if (filters.length === 0) {
			throw new Error(`Invalid filter: ${JSON.stringify(idOrFilter)}`);
		}
		return new Promise((resolve) => {
			let fetchedEvent = null;
			const subscribeOpts = {
				...(opts || {}),
				closeOnEose: true,
			};
			if (relaySet) subscribeOpts.relaySet = relaySet;
			const s = this.subscribe(filters, subscribeOpts, false);
			const t2 = setTimeout(() => {
				s.stop();
				resolve(fetchedEvent);
			}, 1e4);
			s.on("event", (event) => {
				event.ndk = this;
				if (!event.isReplaceable()) {
					clearTimeout(t2);
					resolve(event);
				} else if (
					!fetchedEvent ||
					fetchedEvent.created_at < event.created_at
				) {
					fetchedEvent = event;
				}
			});
			s.on("eose", () => {
				clearTimeout(t2);
				resolve(fetchedEvent);
			});
			s.start();
		});
	}
	async fetchEvents(filters, opts, relaySet) {
		return new Promise((resolve) => {
			const events = /* @__PURE__ */ new Map();
			const subscribeOpts = {
				...(opts || {}),
				closeOnEose: true,
			};
			if (relaySet) subscribeOpts.relaySet = relaySet;
			const relaySetSubscription = this.subscribe(
				filters,
				subscribeOpts,
				false,
			);
			const onEvent = (event) => {
				let _event;
				if (!(event instanceof NDKEvent))
					_event = new NDKEvent(undefined, event);
				else _event = event;
				const dedupKey = _event.deduplicationKey();
				const existingEvent = events.get(dedupKey);
				if (existingEvent) {
					_event = dedup(existingEvent, _event);
				}
				_event.ndk = this;
				events.set(dedupKey, _event);
			};
			relaySetSubscription.on("event", onEvent);
			relaySetSubscription.on("eose", () => {
				resolve(new Set(events.values()));
			});
			relaySetSubscription.start();
		});
	}
	assertSigner() {
		if (!this.signer) {
			this.emit("signer:required");
			throw new Error("Signer required");
		}
	}
	getEntity = getEntity.bind(this);
	set wallet(wallet) {
		if (!wallet) {
			this.walletConfig = undefined;
			return;
		}
		this.walletConfig ??= {};
		this.walletConfig.lnPay = wallet?.lnPay?.bind(wallet);
		this.walletConfig.cashuPay = wallet?.cashuPay?.bind(wallet);
	}
};
var d2 = import_debug12.default("ndk:zapper:ln");
var d3 = import_debug11.default("ndk:zapper");

// src/utils/agents/AgentManager.ts
import path4 from "path";
import fs5 from "fs/promises";

// src/utils/agents/Conversation.ts
class Conversation {
	context;
	constructor(id, agentName, systemPrompt) {
		this.context = {
			id,
			agentName,
			messages: [],
			createdAt: Date.now(),
			lastActivityAt: Date.now(),
		};
		if (systemPrompt) {
			this.addMessage({
				role: "system",
				content: systemPrompt,
				timestamp: Date.now(),
			});
		}
	}
	getId() {
		return this.context.id;
	}
	getAgentName() {
		return this.context.agentName;
	}
	addMessage(message) {
		this.context.messages.push(message);
		this.context.lastActivityAt = Date.now();
	}
	addUserMessage(content, event) {
		this.addMessage({
			role: "user",
			content,
			event,
			timestamp: Date.now(),
		});
	}
	addAssistantMessage(content) {
		this.addMessage({
			role: "assistant",
			content,
			timestamp: Date.now(),
		});
	}
	getMessages() {
		return [...this.context.messages];
	}
	getMessageCount() {
		return this.context.messages.length;
	}
	getLastActivityTime() {
		return this.context.lastActivityAt;
	}
	getFormattedMessages() {
		return this.context.messages.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));
	}
	setMetadata(key, value) {
		if (!this.context.metadata) {
			this.context.metadata = {};
		}
		this.context.metadata[key] = value;
	}
	getMetadata(key) {
		return this.context.metadata?.[key];
	}
	getAllMetadata() {
		return this.context.metadata;
	}
	toJSON() {
		const serializable = {
			...this.context,
			messages: this.context.messages.map((msg) => ({
				...msg,
				event: msg.event ? msg.event.rawEvent() : undefined,
			})),
		};
		return serializable;
	}
	static fromJSON(data) {
		const conversation = new Conversation(data.id, data.agentName);
		conversation.context = data;
		return conversation;
	}
}

// src/utils/agents/ConversationOptimizer.ts
class ConversationOptimizer {
	static DEFAULT_CONTEXT_WINDOW = 128000;
	static RESERVE_TOKENS = 4096;
	static optimizeForContextWindow(
		messages,
		maxTokens = this.DEFAULT_CONTEXT_WINDOW,
	) {
		const effectiveLimit = maxTokens - this.RESERVE_TOKENS;
		const systemMessage = messages.find((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");
		const estimateTokens = (msg) => Math.ceil(msg.content.length / 4);
		let totalTokens = systemMessage ? estimateTokens(systemMessage) : 0;
		const optimizedMessages = [];
		for (let i2 = conversationMessages.length - 1; i2 >= 0; i2--) {
			const msgTokens = estimateTokens(conversationMessages[i2]);
			if (totalTokens + msgTokens > effectiveLimit) {
				break;
			}
			optimizedMessages.unshift(conversationMessages[i2]);
			totalTokens += msgTokens;
		}
		if (systemMessage) {
			optimizedMessages.unshift(systemMessage);
		}
		return optimizedMessages;
	}
	static async summarizeOldMessages(messages, keepLast = 10) {
		if (messages.length <= keepLast) {
			return messages;
		}
		const systemMessage = messages.find((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");
		const recentMessages = conversationMessages.slice(-keepLast);
		const oldMessages = conversationMessages.slice(0, -keepLast);
		const summaryMessage = {
			role: "assistant",
			content: `[Previous conversation summary: ${oldMessages.length} messages exchanged about various topics]`,
			timestamp: Date.now(),
		};
		const result = [];
		if (systemMessage) result.push(systemMessage);
		result.push(summaryMessage);
		result.push(...recentMessages);
		return result;
	}
	static getConversationStats(messages) {
		const estimateTokens = (msg) => Math.ceil(msg.content.length / 4);
		const totalTokens = messages.reduce(
			(sum, msg) => sum + estimateTokens(msg),
			0,
		);
		return {
			messageCount: messages.length,
			estimatedTokens: totalTokens,
			withinStandardContext:
				totalTokens < this.DEFAULT_CONTEXT_WINDOW - this.RESERVE_TOKENS,
			percentOfContext:
				(totalTokens / (this.DEFAULT_CONTEXT_WINDOW - this.RESERVE_TOKENS)) *
				100,
		};
	}
}

// src/utils/logger.ts
function logInfo(message) {
	console.log("[INFO]", message);
}
function logError(message) {
	console.error("[ERROR]", message);
}
function logSuccess(message) {
	console.log("[SUCCESS]", message);
}
function logWarning(message) {
	console.warn("[WARNING]", message);
}
var logger = {
	info: logInfo,
	error: logError,
	success: logSuccess,
	warn: logWarning,
	debug: (message) => console.log("[DEBUG]", message),
};

// src/utils/agents/Agent.ts
import path from "path";
import fs from "fs/promises";

// src/utils/agents/llm/AnthropicProvider.ts
class AnthropicProvider {
	async generateResponse(messages, config) {
		if (!config.apiKey) {
			throw new Error("Anthropic API key is required");
		}
		const baseURL = config.baseURL || "https://api.anthropic.com/v1";
		const model = config.model || "claude-3-opus-20240229";
		const anthropicMessages = messages
			.filter((msg) => msg.role !== "system")
			.map((msg) => ({
				role: msg.role === "assistant" ? "assistant" : "user",
				content: msg.content,
			}));
		const systemMessage = messages.find((msg) => msg.role === "system");
		const requestBody = {
			model,
			messages: anthropicMessages,
			system: systemMessage?.content,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens || 4096,
		};
		logger.debug(`
=== ANTHROPIC API REQUEST ===`);
		logger.debug(`URL: ${baseURL}/messages`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens}`);
		if (requestBody.system) {
			logger.debug(`
System Prompt:
${requestBody.system}`);
		}
		logger.debug(`
Messages (${anthropicMessages.length}):`);
		anthropicMessages.forEach((msg, i2) => {
			logger.debug(
				`[${i2}] ${msg.role}: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`,
			);
		});
		logger.debug(`=== END API REQUEST ===
`);
		try {
			const response = await fetch(`${baseURL}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify(requestBody),
			});
			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Anthropic API error: ${response.status} - ${error}`);
			}
			const data = await response.json();
			return {
				content: data.content[0].text,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.input_tokens,
							completion_tokens: data.usage.output_tokens,
							total_tokens: data.usage.input_tokens + data.usage.output_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`Anthropic provider error: ${error}`);
			throw error;
		}
	}
}

// src/utils/agents/llm/AnthropicProviderWithCache.ts
class AnthropicProviderWithCache {
	async generateResponse(messages, config) {
		if (!config.apiKey) {
			throw new Error("Anthropic API key is required");
		}
		const baseURL = config.baseURL || "https://api.anthropic.com/v1";
		const model = config.model || "claude-3-opus-20240229";
		const systemMessage = messages.find((msg) => msg.role === "system");
		const conversationMessages = messages.filter(
			(msg) => msg.role !== "system",
		);
		const cacheBreakpoint = Math.max(0, conversationMessages.length - 1);
		const anthropicMessages = conversationMessages.map((msg, index) => {
			const content = msg.content;
			if (index < cacheBreakpoint && config.enableCaching !== false) {
				return {
					role: msg.role === "assistant" ? "assistant" : "user",
					content: [
						{
							type: "text",
							text: content,
							cache_control: { type: "ephemeral" },
						},
					],
				};
			}
			return {
				role: msg.role === "assistant" ? "assistant" : "user",
				content,
			};
		});
		const requestBody = {
			model,
			messages: anthropicMessages,
			system: systemMessage?.content
				? [
						{
							type: "text",
							text: systemMessage.content,
							cache_control:
								config.enableCaching !== false
									? { type: "ephemeral" }
									: undefined,
						},
					]
				: undefined,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens || 4096,
		};
		logger.debug(`
=== ANTHROPIC API REQUEST (WITH CACHING) ===`);
		logger.debug(`URL: ${baseURL}/messages`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Caching enabled: ${config.enableCaching !== false}`);
		logger.debug(
			`Cached messages: ${cacheBreakpoint} of ${conversationMessages.length}`,
		);
		logger.debug(`=== END API REQUEST ===
`);
		try {
			const response = await fetch(`${baseURL}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
					"anthropic-beta": "prompt-caching-2024-07-31",
				},
				body: JSON.stringify(requestBody),
			});
			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Anthropic API error: ${response.status} - ${error}`);
			}
			const data = await response.json();
			if (
				data.usage?.cache_creation_input_tokens ||
				data.usage?.cache_read_input_tokens
			) {
				logger.info(
					`Cache usage - Created: ${data.usage.cache_creation_input_tokens || 0}, Read: ${data.usage.cache_read_input_tokens || 0}`,
				);
			}
			return {
				content: data.content[0].text,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.input_tokens,
							completion_tokens: data.usage.output_tokens,
							total_tokens: data.usage.input_tokens + data.usage.output_tokens,
							cache_creation_input_tokens:
								data.usage.cache_creation_input_tokens,
							cache_read_input_tokens: data.usage.cache_read_input_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`Anthropic provider error: ${error}`);
			throw error;
		}
	}
}

// src/utils/agents/llm/OpenAIProvider.ts
class OpenAIProvider {
	async generateResponse(messages, config) {
		if (!config.apiKey) {
			throw new Error("OpenAI API key is required");
		}
		const baseURL = config.baseURL || "https://api.openai.com/v1";
		const model = config.model || "gpt-4";
		const requestBody = {
			model,
			messages,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens,
		};
		logger.debug(`
=== OPENAI API REQUEST ===`);
		logger.debug(`URL: ${baseURL}/chat/completions`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens || "default"}`);
		logger.debug(`
Messages (${messages.length}):`);
		messages.forEach((msg, i2) => {
			logger.debug(`[${i2}] ${msg.role}:`);
			if (msg.role === "system") {
				logger.debug(msg.content);
			} else {
				logger.debug(
					`${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`,
				);
			}
		});
		logger.debug(`=== END API REQUEST ===
`);
		try {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			});
			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenAI API error: ${response.status} - ${error}`);
			}
			const data = await response.json();
			const choice = data.choices[0];
			return {
				content: choice.message.content,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.prompt_tokens,
							completion_tokens: data.usage.completion_tokens,
							total_tokens: data.usage.total_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`OpenAI provider error: ${error}`);
			throw error;
		}
	}
}

// src/utils/agents/llm/OpenRouterProvider.ts
class OpenRouterProvider {
	async generateResponse(messages, config) {
		if (!config.apiKey) {
			throw new Error("OpenRouter API key is required");
		}
		const baseURL = config.baseURL || "https://openrouter.ai/api/v1";
		const model = config.model;
		if (!model) {
			throw new Error("Model is required for OpenRouter");
		}
		const systemMessage = messages.find((msg) => msg.role === "system");
		const conversationMessages = messages.filter(
			(msg) => msg.role !== "system",
		);
		const formattedMessages = [];
		if (systemMessage) {
			if (
				config.enableCaching !== false &&
				systemMessage.content.length > 256
			) {
				formattedMessages.push({
					role: "system",
					content: [
						{
							type: "text",
							text: systemMessage.content,
							cache_control: { type: "ephemeral" },
						},
					],
				});
			} else {
				formattedMessages.push({
					role: "system",
					content: systemMessage.content,
				});
			}
		}
		const cacheBreakpoint = Math.max(0, conversationMessages.length - 1);
		conversationMessages.forEach((msg, index) => {
			if (config.enableCaching !== false && index < cacheBreakpoint) {
				formattedMessages.push({
					role: msg.role,
					content: [
						{
							type: "text",
							text: msg.content,
							cache_control: { type: "ephemeral" },
						},
					],
				});
			} else {
				formattedMessages.push({
					role: msg.role,
					content: msg.content,
				});
			}
		});
		const requestBody = {
			model,
			messages: formattedMessages,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens || 4096,
			usage: { include: true },
		};
		if (config.additionalParams) {
			Object.assign(requestBody, config.additionalParams);
		}
		logger.debug(`
=== OPENROUTER API REQUEST (WITH CACHING) ===`);
		logger.debug(`URL: ${baseURL}/chat/completions`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens}`);
		logger.debug(`Caching enabled: ${config.enableCaching !== false}`);
		let cachedMessages = 0;
		formattedMessages.forEach((msg) => {
			if (Array.isArray(msg.content)) {
				msg.content.forEach((c) => {
					if (c.cache_control) cachedMessages++;
				});
			}
		});
		logger.debug(`Messages with cache control: ${cachedMessages}`);
		logger.debug(`=== END API REQUEST ===
`);
		try {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
					"HTTP-Referer": config.appName || "tenex-cli",
					"X-Title": config.appTitle || "TENEX CLI Agent",
				},
				body: JSON.stringify(requestBody),
			});
			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
			}
			const data = await response.json();
			if (data.usage?.cached_tokens) {
				logger.info(
					`OpenRouter cache hit! Cached tokens: ${data.usage.cached_tokens}`,
				);
			}
			if (data.cache_discount) {
				logger.info(`Cache discount: ${data.cache_discount}`);
			}
			const choice = data.choices[0];
			return {
				content: choice.message.content,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.prompt_tokens,
							completion_tokens: data.usage.completion_tokens,
							total_tokens: data.usage.total_tokens,
							cache_read_input_tokens: data.usage.cached_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`OpenRouter provider error: ${error}`);
			throw error;
		}
	}
}

// src/utils/agents/llm/LLMFactory.ts
class LLMFactory {
	static providers = new Map();
	static createProvider(config) {
		const cacheKey = `${config.provider}-${config.model}-${config.baseURL || "default"}-${config.enableCaching !== false}`;
		const cached = this.providers.get(cacheKey);
		if (cached) {
			return cached;
		}
		let provider;
		switch (config.provider.toLowerCase()) {
			case "anthropic":
			case "claude":
				provider =
					config.enableCaching !== false
						? new AnthropicProviderWithCache()
						: new AnthropicProvider();
				break;
			case "openai":
			case "gpt":
				provider = new OpenAIProvider();
				break;
			case "openrouter":
				provider = new OpenRouterProvider();
				break;
			case "ollama":
				provider = new OpenAIProvider();
				break;
			default:
				logger.warn(
					`Unknown provider '${config.provider}', attempting OpenAI-compatible API`,
				);
				provider = new OpenAIProvider();
		}
		this.providers.set(cacheKey, provider);
		return provider;
	}
	static clearCache() {
		this.providers.clear();
	}
}

// src/utils/agents/Agent.ts
class Agent {
	name;
	nsec;
	signer;
	config;
	conversations;
	defaultLLMConfig;
	storage;
	constructor(name, nsec, config, storage) {
		this.name = name;
		this.nsec = nsec;
		this.signer = new NDKPrivateKeySigner(nsec);
		this.config = config;
		this.conversations = new Map();
		this.storage = storage;
	}
	getName() {
		return this.name;
	}
	getNsec() {
		return this.nsec;
	}
	getSigner() {
		return this.signer;
	}
	getPubkey() {
		return this.signer.pubkey;
	}
	getConfig() {
		return this.config;
	}
	setDefaultLLMConfig(config) {
		this.defaultLLMConfig = config;
	}
	getDefaultLLMConfig() {
		return this.defaultLLMConfig;
	}
	getSystemPrompt() {
		if (this.config.systemPrompt) {
			return this.config.systemPrompt;
		}
		const parts = [];
		if (this.config.role) {
			parts.push(`You are ${this.config.role}.`);
		} else {
			parts.push(`You are ${this.name}.`);
		}
		if (this.config.description) {
			parts.push(this.config.description);
		}
		if (this.config.instructions) {
			parts.push(`
Instructions:`);
			parts.push(this.config.instructions);
		}
		return parts.join(`
`);
	}
	async createConversation(conversationId) {
		const systemPrompt = this.getSystemPrompt();
		const conversation = new Conversation(
			conversationId,
			this.name,
			systemPrompt,
		);
		this.conversations.set(conversationId, conversation);
		if (this.storage) {
			await this.storage.saveConversation(conversation.toJSON());
		}
		logger.info(
			`Created new conversation ${conversationId} for agent ${this.name}`,
		);
		return conversation;
	}
	getConversation(conversationId) {
		return this.conversations.get(conversationId);
	}
	async getOrCreateConversation(conversationId) {
		let conversation = this.conversations.get(conversationId);
		if (!conversation && this.storage) {
			const savedContext = await this.storage.loadConversation(conversationId);
			if (savedContext) {
				conversation = Conversation.fromJSON(savedContext);
				this.conversations.set(conversationId, conversation);
				logger.info(`Loaded conversation ${conversationId} from storage`);
			}
		}
		if (!conversation) {
			conversation = await this.createConversation(conversationId);
		}
		return conversation;
	}
	getAllConversations() {
		return new Map(this.conversations);
	}
	removeConversation(conversationId) {
		return this.conversations.delete(conversationId);
	}
	extractConversationId(event) {
		const eTag = event.tags.find((tag) => tag[0] === "e");
		if (eTag && eTag[1]) {
			return eTag[1];
		}
		const rootTag = event.tags.find((tag) => tag[0] === "root");
		if (rootTag && rootTag[1]) {
			return rootTag[1];
		}
		return event.id;
	}
	static async loadFromConfig(name, nsec, projectPath, storage) {
		const configPath = path.join(
			projectPath,
			".tenex",
			"agents",
			`${name}.json`,
		);
		let config = { name };
		try {
			const configData = await fs.readFile(configPath, "utf-8");
			const loadedConfig = JSON.parse(configData);
			config = { ...config, ...loadedConfig };
			logger.info(`Loaded agent config for ${name} from ${configPath}`);
		} catch (error) {
			logger.info(`No agent config found for ${name}, using defaults`);
		}
		return new Agent(name, nsec, config, storage);
	}
	async saveConfig(projectPath) {
		const configPath = path.join(
			projectPath,
			".tenex",
			"agents",
			`${this.name}.json`,
		);
		await fs.mkdir(path.dirname(configPath), { recursive: true });
		await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
		logger.info(`Saved agent config for ${this.name} to ${configPath}`);
	}
	async generateResponse(conversationId, llmConfig) {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`);
		}
		const config = llmConfig || this.defaultLLMConfig;
		if (!config) {
			throw new Error("No LLM configuration available");
		}
		try {
			const provider = LLMFactory.createProvider(config);
			let messages = conversation.getFormattedMessages();
			const contextWindowSize = config.contextWindowSize || 128000;
			const stats = ConversationOptimizer.getConversationStats(messages);
			if (!stats.withinStandardContext) {
				logger.warn(
					`Conversation exceeds context window (${stats.estimatedTokens} tokens, ${stats.percentOfContext.toFixed(1)}% of limit)`,
				);
				messages = ConversationOptimizer.optimizeForContextWindow(
					messages,
					contextWindowSize,
				);
				logger.info(`Optimized conversation to ${messages.length} messages`);
			}
			logger.info(`
=== LLM PROMPT DEBUG ===`);
			logger.info(`Agent: ${this.name}`);
			logger.info(`Conversation ID: ${conversationId}`);
			logger.info(`Provider: ${config.provider}`);
			logger.info(`Model: ${config.model}`);
			logger.info(`Temperature: ${config.temperature ?? 0.7}`);
			logger.info(`Max Tokens: ${config.maxTokens || 4096}`);
			logger.info(`Context Window: ${contextWindowSize}`);
			logger.info(`Caching Enabled: ${config.enableCaching !== false}`);
			logger.info(`
Conversation Stats:`);
			logger.info(`  Total Messages: ${conversation.getMessageCount()}`);
			logger.info(`  Optimized Messages: ${messages.length}`);
			logger.info(`  Estimated Tokens: ${stats.estimatedTokens}`);
			logger.info(`  Context Usage: ${stats.percentOfContext.toFixed(1)}%`);
			logger.info(`
Messages being sent:`);
			messages.forEach((msg, index) => {
				logger.info(`
[${index}] Role: ${msg.role}`);
				if (msg.role === "system") {
					logger.info(`System Prompt:
${msg.content}`);
				} else {
					logger.info(
						`Content: ${msg.content.slice(0, 300)}${msg.content.length > 300 ? "..." : ""}`,
					);
				}
			});
			logger.info(`=== END PROMPT DEBUG ===
`);
			logger.info(
				`Generating response for conversation ${conversationId} using ${config.provider}/${config.model}`,
			);
			const response = await provider.generateResponse(messages, config);
			conversation.addAssistantMessage(response.content);
			if (this.storage) {
				await this.storage.saveConversation(conversation.toJSON());
			}
			return {
				content: response.content,
				confidence: 0.8,
				metadata: {
					model: response.model || config.model,
					provider: config.provider,
					usage: response.usage,
				},
			};
		} catch (error) {
			logger.error(`Failed to generate response: ${error}`);
			throw error;
		}
	}
	async generateResponseForEvent(event, llmConfig) {
		const conversationId = this.extractConversationId(event);
		const conversation = await this.getOrCreateConversation(conversationId);
		conversation.addUserMessage(event.content, event);
		if (this.storage) {
			await this.storage.saveConversation(conversation.toJSON());
		}
		return this.generateResponse(conversationId, llmConfig);
	}
}

import path2 from "path";
// src/utils/agents/ConversationStorage.ts
import fs2 from "fs/promises";
class ConversationStorage {
	storageDir;
	processedEventsFile;
	processedEvents;
	constructor(projectPath) {
		this.storageDir = path2.join(projectPath, ".tenex", "conversations");
		this.processedEventsFile = path2.join(
			this.storageDir,
			"processed-events.json",
		);
		this.processedEvents = new Map();
	}
	async initialize() {
		await fs2.mkdir(this.storageDir, { recursive: true });
		await this.loadProcessedEvents();
	}
	async loadProcessedEvents() {
		try {
			const data = await fs2.readFile(this.processedEventsFile, "utf-8");
			const events = JSON.parse(data);
			this.processedEvents = new Map(Object.entries(events));
			logger.info(`Loaded ${this.processedEvents.size} processed events`);
		} catch (error) {
			logger.info("No processed events file found, starting fresh");
		}
	}
	async saveProcessedEvents() {
		const data = Object.fromEntries(this.processedEvents);
		await fs2.writeFile(
			this.processedEventsFile,
			JSON.stringify(data, null, 2),
		);
	}
	async markEventProcessed(eventId, timestamp) {
		this.processedEvents.set(eventId, timestamp);
		await this.saveProcessedEvents();
	}
	isEventProcessed(eventId) {
		return this.processedEvents.has(eventId);
	}
	getProcessedEventTimestamp(eventId) {
		return this.processedEvents.get(eventId);
	}
	async saveConversation(conversation) {
		const data =
			"toJSON" in conversation ? conversation.toJSON() : conversation;
		const fileName = `${data.id}.json`;
		const filePath = path2.join(this.storageDir, fileName);
		await fs2.writeFile(filePath, JSON.stringify(data, null, 2));
		logger.info(`Saved conversation ${data.id} to ${filePath}`);
	}
	async loadConversation(conversationId) {
		const fileName = `${conversationId}.json`;
		const filePath = path2.join(this.storageDir, fileName);
		try {
			const data = await fs2.readFile(filePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			return null;
		}
	}
	async listConversations() {
		try {
			const files = await fs2.readdir(this.storageDir);
			return files
				.filter((f) => f.endsWith(".json") && f !== "processed-events.json")
				.map((f) => f.replace(".json", ""));
		} catch (error) {
			return [];
		}
	}
	async deleteConversation(conversationId) {
		const fileName = `${conversationId}.json`;
		const filePath = path2.join(this.storageDir, fileName);
		try {
			await fs2.unlink(filePath);
			logger.info(`Deleted conversation ${conversationId}`);
		} catch (error) {
			logger.warn(`Failed to delete conversation ${conversationId}: ${error}`);
		}
	}
	async cleanupOldConversations(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
		const now2 = Date.now();
		const conversations = await this.listConversations();
		for (const id of conversations) {
			const conversation = await this.loadConversation(id);
			if (conversation && now2 - conversation.lastActivityAt > maxAgeMs) {
				await this.deleteConversation(id);
			}
		}
	}
}

// src/utils/agentManager.ts
import path3 from "path";
import fs4 from "fs/promises";

// src/utils/file.ts
import * as fs3 from "fs";
import * as os from "os";
import * as pathModule from "path";
function expandHome(filePath) {
	if (filePath.startsWith("~")) {
		return pathModule.join(os.homedir(), filePath.slice(1));
	}
	return filePath;
}
function readFile(path3) {
	const fullPath = expandHome(path3);
	try {
		return fs3.readFileSync(fullPath, "utf8");
	} catch (err) {
		throw new Error(`Failed to read file: ${fullPath}
${err}`);
	}
}

// src/nostr/ndkClient.ts
var ndkInstance = null;
async function getNDK() {
	if (!ndkInstance) {
		ndkInstance = new NDK({
			explicitRelayUrls: [
				"wss://relay.nostr.band",
				"wss://relay.damus.io",
				"wss://relay.primal.net",
			],
		});
		await ndkInstance.connect();
	}
	return ndkInstance;
}

// src/utils/agentManager.ts
async function getAgentSigner(projectPath, agentSlug = "default") {
	const agentsPath = path3.join(projectPath, ".tenex", "agents.json");
	let agents = {};
	let isNew = false;
	try {
		const agentsData = await readFile(agentsPath);
		agents = JSON.parse(agentsData);
	} catch (error) {
		logger.warn("Failed to load agents.json, will create if needed:", error);
	}
	if (!agents[agentSlug]) {
		logger.info(`Agent '${agentSlug}' not found, creating new agent...`);
		isNew = true;
		const newSigner = NDKPrivateKeySigner.generate();
		const nsec2 = newSigner.nsec;
		const metadataPath = path3.join(projectPath, ".tenex", "metadata.json");
		let projectName = "Project";
		try {
			const metadata = JSON.parse(await readFile(metadataPath));
			projectName = metadata.name || metadata.title || "Project";
		} catch (error) {
			logger.warn("Could not load project metadata:", error);
		}
		agents[agentSlug] = nsec2;
		await fs4.mkdir(path3.dirname(agentsPath), { recursive: true });
		await fs4.writeFile(agentsPath, JSON.stringify(agents, null, 2));
		const agentName =
			agentSlug === "default" ? projectName : `${agentSlug} @ ${projectName}`;
		logger.info(`Created new agent '${agentSlug}' with name '${agentName}'`);
		await publishAgentProfile(nsec2, agentName, projectName);
	}
	const nsec = agents[agentSlug];
	const signer = new NDKPrivateKeySigner(nsec);
	return { signer, nsec, isNew };
}
async function publishAgentProfile(nsec, agentName, projectName) {
	try {
		const ndk = await getNDK();
		const signer = new NDKPrivateKeySigner(nsec);
		const profileEvent = new NDKEvent(ndk);
		profileEvent.kind = 0;
		profileEvent.content = JSON.stringify({
			name: agentName,
			about: `AI agent for ${projectName}`,
			picture:
				"https://raw.githubusercontent.com/pablof7z/wiki/refs/heads/main/attachments/robot.webp",
			lud06: "",
			display_name: agentName,
		});
		profileEvent.ndk = ndk;
		await profileEvent.sign(signer);
		await profileEvent.publish();
		logger.info(`Published profile for agent '${agentName}'`);
	} catch (error) {
		logger.error("Failed to publish agent profile:", error);
	}
}

// src/utils/agents/AgentManager.ts
class AgentManager {
	projectPath;
	agents;
	llmConfigs;
	defaultLLM;
	conversationStorage;
	constructor(projectPath) {
		this.projectPath = projectPath;
		this.agents = new Map();
		this.llmConfigs = new Map();
		this.conversationStorage = new ConversationStorage(projectPath);
	}
	async initialize() {
		await this.conversationStorage.initialize();
		await this.loadLLMConfigs();
		await this.loadAgents();
		await this.conversationStorage.cleanupOldConversations();
		logger.info("Cleaned up old conversations");
	}
	async loadLLMConfigs() {
		const llmsPath = path4.join(this.projectPath, ".tenex", "llms.json");
		try {
			const content = await fs5.readFile(llmsPath, "utf-8");
			const configs = JSON.parse(content);
			this.defaultLLM = configs.default;
			for (const [name, config] of Object.entries(configs)) {
				if (name !== "default" && typeof config === "object") {
					this.llmConfigs.set(name, config);
					logger.info(`Loaded LLM config: ${name}`);
				}
			}
			if (this.defaultLLM) {
				logger.info(`Default LLM: ${this.defaultLLM}`);
			}
		} catch (error) {
			logger.warn("No llms.json found or failed to load:", error);
		}
	}
	async loadAgents() {
		const agentsPath = path4.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs5.readFile(agentsPath, "utf-8");
			const agentsConfig = JSON.parse(content);
			for (const [name, nsec] of Object.entries(agentsConfig)) {
				const agent = await Agent.loadFromConfig(
					name,
					nsec,
					this.projectPath,
					this.conversationStorage,
				);
				if (this.defaultLLM && this.llmConfigs.has(this.defaultLLM)) {
					agent.setDefaultLLMConfig(this.llmConfigs.get(this.defaultLLM));
				}
				this.agents.set(name, agent);
				logger.info(`Loaded agent: ${name}`);
			}
		} catch (error) {
			logger.warn(`No agents.json found or failed to load: ${error.message}`);
		}
	}
	async getAgent(name = "default") {
		let agent = this.agents.get(name);
		if (!agent) {
			logger.info(`Agent '${name}' not found, creating new agent...`);
			const { nsec } = await getAgentSigner(this.projectPath, name);
			agent = await Agent.loadFromConfig(
				name,
				nsec,
				this.projectPath,
				this.conversationStorage,
			);
			if (this.defaultLLM && this.llmConfigs.has(this.defaultLLM)) {
				agent.setDefaultLLMConfig(this.llmConfigs.get(this.defaultLLM));
			}
			this.agents.set(name, agent);
		}
		return agent;
	}
	getLLMConfig(name) {
		if (name) {
			return this.llmConfigs.get(name);
		}
		if (this.defaultLLM) {
			return this.llmConfigs.get(this.defaultLLM);
		}
		return this.llmConfigs.values().next().value;
	}
	getAllAgents() {
		return new Map(this.agents);
	}
	getAllLLMConfigs() {
		return new Map(this.llmConfigs);
	}
	getProjectPath() {
		return this.projectPath;
	}
	getConversationStorage() {
		return this.conversationStorage;
	}
	async isEventFromAnyAgent(eventPubkey) {
		for (const agent of this.agents.values()) {
			if (agent.getPubkey() === eventPubkey) {
				return true;
			}
		}
		const agentsPath = path4.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs5.readFile(agentsPath, "utf-8");
			const agentsConfig = JSON.parse(content);
			for (const [name, nsec] of Object.entries(agentsConfig)) {
				const signer = new NDKPrivateKeySigner(nsec);
				if (signer.pubkey === eventPubkey) {
					logger.info(
						`Event is from agent '${name}' (pubkey: ${eventPubkey.slice(0, 8)}...)`,
					);
					return true;
				}
			}
		} catch (error) {
			logger.warn("Failed to check agents.json for pubkey comparison");
		}
		return false;
	}
	async handleChatEvent(event, ndk, agentName = "default", llmName) {
		try {
			if (this.conversationStorage.isEventProcessed(event.id)) {
				logger.info(`Skipping already processed chat event ${event.id}`);
				return;
			}
			const agent = await this.getAgent(agentName);
			if (await this.isEventFromAnyAgent(event.author.pubkey)) {
				logger.info(`Skipping chat event from an agent's pubkey: ${event.id}`);
				return;
			}
			const llmConfig = this.getLLMConfig(llmName);
			if (!llmConfig) {
				logger.error("No LLM configuration available for chat response");
				return;
			}
			const response = await agent.generateResponseForEvent(event, llmConfig);
			await this.publishResponse(ndk, event, response.content, agent);
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
			logger.info(
				`Chat response generated and published by agent '${agentName}'`,
			);
		} catch (error) {
			logger.error(`Failed to handle chat event: ${error}`);
			logger.error(
				`Error details: ${error instanceof Error ? error.stack : String(error)}`,
			);
			logger.error(`Event ID: ${event.id}`);
			logger.error(`Event content preview: ${event.content?.slice(0, 100)}...`);
		}
	}
	async handleTaskEvent(event, ndk, agentName = "default", llmName) {
		try {
			if (this.conversationStorage.isEventProcessed(event.id)) {
				logger.info(`Skipping already processed task event ${event.id}`);
				return;
			}
			const agent = await this.getAgent(agentName);
			if (await this.isEventFromAnyAgent(event.author.pubkey)) {
				logger.info(`Skipping task event from an agent's pubkey: ${event.id}`);
				return;
			}
			const taskId = event.id;
			const conversation = await agent.getOrCreateConversation(taskId);
			const titleTag = event.tags.find((tag) => tag[0] === "title");
			const title = titleTag ? titleTag[1] : "Untitled Task";
			const taskContent = `Task: ${title}

Description:
${event.content}`;
			conversation.addUserMessage(taskContent, event);
			conversation.setMetadata("taskId", taskId);
			conversation.setMetadata("taskTitle", title);
			await this.conversationStorage.saveConversation(conversation.toJSON());
			const llmConfig = this.getLLMConfig(llmName);
			if (!llmConfig) {
				logger.error("No LLM configuration available for task response");
				return;
			}
			const response = await agent.generateResponse(taskId, llmConfig);
			await this.publishTaskStatus(ndk, event, response.content, agent);
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
			logger.info(`Task '${title}' response generated by agent '${agentName}'`);
		} catch (error) {
			logger.error(`Failed to handle task event: ${error}`);
			logger.error(
				`Error details: ${error instanceof Error ? error.stack : String(error)}`,
			);
			logger.error(`Event ID: ${event.id}`);
			logger.error(
				`Task title: ${event.tags.find((tag) => tag[0] === "title")?.[1] || "Unknown"}`,
			);
		}
	}
	async publishResponse(ndk, originalEvent, content, agent) {
		try {
			const replyEvent = originalEvent.reply();
			replyEvent.content = content;
			const aTag = originalEvent.tags.find((tag) => tag[0] === "a");
			if (aTag) {
				replyEvent.tags.push(aTag);
			}
			await replyEvent.sign(agent.getSigner());
			replyEvent.publish();
			logger.info(`Published response to event ${originalEvent.id}`);
			logger.debug(`Reply event ID: ${replyEvent.id}`);
			logger.debug(
				`Reply content preview: ${replyEvent.content.slice(0, 100)}...`,
			);
			const rawEvent = replyEvent.rawEvent();
			logger.debug(`Reply event raw: ${JSON.stringify(rawEvent, null, 2)}`);
		} catch (error) {
			logger.error(`Failed to publish response: ${error}`);
		}
	}
	async publishTaskStatus(ndk, taskEvent, content, agent) {
		try {
			const statusEvent = taskEvent.reply();
			statusEvent.content = content;
			const projectTag = taskEvent.tags.find((tag) => tag[0] === "a");
			if (projectTag) {
				statusEvent.tags.push(projectTag);
			}
			await statusEvent.sign(agent.getSigner());
			await statusEvent.publish();
			logger.info(`Published task status for ${taskEvent.id}`);
		} catch (error) {
			logger.error(`Failed to publish task status: ${error}`);
		}
	}
}
export { AgentManager };
