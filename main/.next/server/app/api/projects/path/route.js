/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/projects/path/route";
exports.ids = ["app/api/projects/path/route"];
exports.modules = {

/***/ "(rsc)/./app/api/projects/path/route.ts":
/*!****************************************!*\
  !*** ./app/api/projects/path/route.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/api/server.js\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! path */ \"path\");\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);\n\n\n\nasync function GET(req) {\n    try {\n        const searchParams = req.nextUrl.searchParams;\n        const filePath = searchParams.get(\"path\");\n        if (filePath) {\n            // Read a specific file\n            const projectsPath = process.env.PROJECTS_PATH || path__WEBPACK_IMPORTED_MODULE_2___default().join(process.cwd(), \"projects\");\n            // Security check: ensure the path is within the projects directory\n            const resolvedPath = path__WEBPACK_IMPORTED_MODULE_2___default().resolve(filePath);\n            const resolvedProjectsPath = path__WEBPACK_IMPORTED_MODULE_2___default().resolve(projectsPath);\n            if (!resolvedPath.startsWith(resolvedProjectsPath)) {\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                    error: \"Invalid file path\"\n                }, {\n                    status: 403\n                });\n            }\n            if (!fs__WEBPACK_IMPORTED_MODULE_1___default().existsSync(resolvedPath)) {\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                    error: \"File not found\"\n                }, {\n                    status: 404\n                });\n            }\n            try {\n                const content = fs__WEBPACK_IMPORTED_MODULE_1___default().readFileSync(resolvedPath, \"utf8\");\n                const data = JSON.parse(content);\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(data);\n            } catch (error) {\n                console.error(\"Error reading file:\", error);\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                    error: \"Failed to read file\"\n                }, {\n                    status: 500\n                });\n            }\n        } else {\n            // Return the projects path\n            const projectsPath = process.env.PROJECTS_PATH;\n            if (!projectsPath) {\n                return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                    error: \"PROJECTS_PATH environment variable is not set\"\n                }, {\n                    status: 500\n                });\n            }\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                projectsPath\n            });\n        }\n    } catch (error) {\n        console.error(\"Error processing request:\", error);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Failed to process request\"\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3Byb2plY3RzL3BhdGgvcm91dGUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQXdEO0FBQ3BDO0FBQ0k7QUFFakIsZUFBZUcsSUFBSUMsR0FBZ0I7SUFDdEMsSUFBSTtRQUNBLE1BQU1DLGVBQWVELElBQUlFLE9BQU8sQ0FBQ0QsWUFBWTtRQUM3QyxNQUFNRSxXQUFXRixhQUFhRyxHQUFHLENBQUM7UUFFbEMsSUFBSUQsVUFBVTtZQUNWLHVCQUF1QjtZQUN2QixNQUFNRSxlQUFlQyxRQUFRQyxHQUFHLENBQUNDLGFBQWEsSUFBSVYsZ0RBQVMsQ0FBQ1EsUUFBUUksR0FBRyxJQUFJO1lBRTNFLG1FQUFtRTtZQUNuRSxNQUFNQyxlQUFlYixtREFBWSxDQUFDSztZQUNsQyxNQUFNVSx1QkFBdUJmLG1EQUFZLENBQUNPO1lBRTFDLElBQUksQ0FBQ00sYUFBYUcsVUFBVSxDQUFDRCx1QkFBdUI7Z0JBQ2hELE9BQU9qQixxREFBWUEsQ0FBQ21CLElBQUksQ0FBQztvQkFBRUMsT0FBTztnQkFBb0IsR0FBRztvQkFBRUMsUUFBUTtnQkFBSTtZQUMzRTtZQUVBLElBQUksQ0FBQ3BCLG9EQUFhLENBQUNjLGVBQWU7Z0JBQzlCLE9BQU9mLHFEQUFZQSxDQUFDbUIsSUFBSSxDQUFDO29CQUFFQyxPQUFPO2dCQUFpQixHQUFHO29CQUFFQyxRQUFRO2dCQUFJO1lBQ3hFO1lBRUEsSUFBSTtnQkFDQSxNQUFNRSxVQUFVdEIsc0RBQWUsQ0FBQ2MsY0FBYztnQkFDOUMsTUFBTVUsT0FBT0MsS0FBS0MsS0FBSyxDQUFDSjtnQkFDeEIsT0FBT3ZCLHFEQUFZQSxDQUFDbUIsSUFBSSxDQUFDTTtZQUM3QixFQUFFLE9BQU9MLE9BQU87Z0JBQ1pRLFFBQVFSLEtBQUssQ0FBQyx1QkFBdUJBO2dCQUNyQyxPQUFPcEIscURBQVlBLENBQUNtQixJQUFJLENBQUM7b0JBQUVDLE9BQU87Z0JBQXNCLEdBQUc7b0JBQUVDLFFBQVE7Z0JBQUk7WUFDN0U7UUFDSixPQUFPO1lBQ0gsMkJBQTJCO1lBQzNCLE1BQU1aLGVBQWVDLFFBQVFDLEdBQUcsQ0FBQ0MsYUFBYTtZQUU5QyxJQUFJLENBQUNILGNBQWM7Z0JBQ2YsT0FBT1QscURBQVlBLENBQUNtQixJQUFJLENBQUM7b0JBQUVDLE9BQU87Z0JBQWdELEdBQUc7b0JBQUVDLFFBQVE7Z0JBQUk7WUFDdkc7WUFFQSxPQUFPckIscURBQVlBLENBQUNtQixJQUFJLENBQUM7Z0JBQUVWO1lBQWE7UUFDNUM7SUFDSixFQUFFLE9BQU9XLE9BQU87UUFDWlEsUUFBUVIsS0FBSyxDQUFDLDZCQUE2QkE7UUFDM0MsT0FBT3BCLHFEQUFZQSxDQUFDbUIsSUFBSSxDQUFDO1lBQUVDLE9BQU87UUFBNEIsR0FBRztZQUFFQyxRQUFRO1FBQUk7SUFDbkY7QUFDSiIsInNvdXJjZXMiOlsiL1VzZXJzL3BhYmxvZmVybmFuZGV6L3Rlc3QxMjMvVEVORVgtcGZrbWM5L21haW4vYXBwL2FwaS9wcm9qZWN0cy9wYXRoL3JvdXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXNwb25zZSwgTmV4dFJlcXVlc3QgfSBmcm9tIFwibmV4dC9zZXJ2ZXJcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxOiBOZXh0UmVxdWVzdCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlYXJjaFBhcmFtcyA9IHJlcS5uZXh0VXJsLnNlYXJjaFBhcmFtcztcbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSBzZWFyY2hQYXJhbXMuZ2V0KFwicGF0aFwiKTtcblxuICAgICAgICBpZiAoZmlsZVBhdGgpIHtcbiAgICAgICAgICAgIC8vIFJlYWQgYSBzcGVjaWZpYyBmaWxlXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0c1BhdGggPSBwcm9jZXNzLmVudi5QUk9KRUNUU19QQVRIIHx8IHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInByb2plY3RzXCIpO1xuXG4gICAgICAgICAgICAvLyBTZWN1cml0eSBjaGVjazogZW5zdXJlIHRoZSBwYXRoIGlzIHdpdGhpbiB0aGUgcHJvamVjdHMgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRQcm9qZWN0c1BhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdHNQYXRoKTtcblxuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZFBhdGguc3RhcnRzV2l0aChyZXNvbHZlZFByb2plY3RzUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIGZpbGUgcGF0aFwiIH0sIHsgc3RhdHVzOiA0MDMgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiRmlsZSBub3QgZm91bmRcIiB9LCB7IHN0YXR1czogNDA0IH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWRQYXRoLCBcInV0ZjhcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGRhdGEpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVhZGluZyBmaWxlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHJlYWQgZmlsZVwiIH0sIHsgc3RhdHVzOiA1MDAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBSZXR1cm4gdGhlIHByb2plY3RzIHBhdGhcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3RzUGF0aCA9IHByb2Nlc3MuZW52LlBST0pFQ1RTX1BBVEg7XG5cbiAgICAgICAgICAgIGlmICghcHJvamVjdHNQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiUFJPSkVDVFNfUEFUSCBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBub3Qgc2V0XCIgfSwgeyBzdGF0dXM6IDUwMCB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgcHJvamVjdHNQYXRoIH0pO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHByb2Nlc3NpbmcgcmVxdWVzdDpcIiwgZXJyb3IpO1xuICAgICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gcHJvY2VzcyByZXF1ZXN0XCIgfSwgeyBzdGF0dXM6IDUwMCB9KTtcbiAgICB9XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiZnMiLCJwYXRoIiwiR0VUIiwicmVxIiwic2VhcmNoUGFyYW1zIiwibmV4dFVybCIsImZpbGVQYXRoIiwiZ2V0IiwicHJvamVjdHNQYXRoIiwicHJvY2VzcyIsImVudiIsIlBST0pFQ1RTX1BBVEgiLCJqb2luIiwiY3dkIiwicmVzb2x2ZWRQYXRoIiwicmVzb2x2ZSIsInJlc29sdmVkUHJvamVjdHNQYXRoIiwic3RhcnRzV2l0aCIsImpzb24iLCJlcnJvciIsInN0YXR1cyIsImV4aXN0c1N5bmMiLCJjb250ZW50IiwicmVhZEZpbGVTeW5jIiwiZGF0YSIsIkpTT04iLCJwYXJzZSIsImNvbnNvbGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/projects/path/route.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fprojects%2Fpath%2Froute&page=%2Fapi%2Fprojects%2Fpath%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprojects%2Fpath%2Froute.ts&appDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fprojects%2Fpath%2Froute&page=%2Fapi%2Fprojects%2Fpath%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprojects%2Fpath%2Froute.ts&appDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_pablofernandez_test123_TENEX_pfkmc9_main_app_api_projects_path_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/projects/path/route.ts */ \"(rsc)/./app/api/projects/path/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/projects/path/route\",\n        pathname: \"/api/projects/path\",\n        filename: \"route\",\n        bundlePath: \"app/api/projects/path/route\"\n    },\n    resolvedPagePath: \"/Users/pablofernandez/test123/TENEX-pfkmc9/main/app/api/projects/path/route.ts\",\n    nextConfigOutput,\n    userland: _Users_pablofernandez_test123_TENEX_pfkmc9_main_app_api_projects_path_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvLnBucG0vbmV4dEAxNS4yLjRfcmVhY3QtZG9tQDE5LjEuMF9yZWFjdEAxOS4xLjBfX3JlYWN0QDE5LjEuMC9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZwcm9qZWN0cyUyRnBhdGglMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRnByb2plY3RzJTJGcGF0aCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRnByb2plY3RzJTJGcGF0aCUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRnBhYmxvZmVybmFuZGV6JTJGdGVzdDEyMyUyRlRFTkVYLXBma21jOSUyRm1haW4lMkZhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPSUyRlVzZXJzJTJGcGFibG9mZXJuYW5kZXolMkZ0ZXN0MTIzJTJGVEVORVgtcGZrbWM5JTJGbWFpbiZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDcUI7QUFDOEI7QUFDM0c7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLHlHQUFtQjtBQUMzQztBQUNBLGNBQWMsa0VBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxzREFBc0Q7QUFDOUQ7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDMEY7O0FBRTFGIiwic291cmNlcyI6WyIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwUm91dGVSb3V0ZU1vZHVsZSB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIi9Vc2Vycy9wYWJsb2Zlcm5hbmRlei90ZXN0MTIzL1RFTkVYLXBma21jOS9tYWluL2FwcC9hcGkvcHJvamVjdHMvcGF0aC9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvcHJvamVjdHMvcGF0aC9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL3Byb2plY3RzL3BhdGhcIixcbiAgICAgICAgZmlsZW5hbWU6IFwicm91dGVcIixcbiAgICAgICAgYnVuZGxlUGF0aDogXCJhcHAvYXBpL3Byb2plY3RzL3BhdGgvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvcGFibG9mZXJuYW5kZXovdGVzdDEyMy9URU5FWC1wZmttYzkvbWFpbi9hcHAvYXBpL3Byb2plY3RzL3BhdGgvcm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICB3b3JrQXN5bmNTdG9yYWdlLFxuICAgICAgICB3b3JrVW5pdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fprojects%2Fpath%2Froute&page=%2Fapi%2Fprojects%2Fpath%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprojects%2Fpath%2Froute.ts&appDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!*********************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \*********************************************************************************************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!*********************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \*********************************************************************************************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0"], () => (__webpack_exec__("(rsc)/./node_modules/.pnpm/next@15.2.4_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fprojects%2Fpath%2Froute&page=%2Fapi%2Fprojects%2Fpath%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fprojects%2Fpath%2Froute.ts&appDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fpablofernandez%2Ftest123%2FTENEX-pfkmc9%2Fmain&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();