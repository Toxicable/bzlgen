load("@npm_bazel_typescript//:index.bzl", "ts_library")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")

RUNTIME_NPM_DEPS = [
    "@npm//yargs",
    "@npm//signale",
    "@npm//lodash.kebabcase",
    "@npm//shelljs",
    "@npm//gonzales-pe",
    "@npm//@phenomnomnominal/tsquery",
    "@npm//typescript",
]

ts_library(
    name = "src",
    srcs = glob(["**/*.ts"]),
    tsconfig = "//:tsconfig",
    visibility = [
        "//:__pkg__",
        "//test:__subpackages__",
    ],
    deps = [
        "@npm//@types/node",
    ] + RUNTIME_NPM_DEPS,
    module_name = "@evertz/bzlgen/src",
)

nodejs_binary(
    name = "bin",
    data = [
        ":src",
        "//:.bzlgenrc",
    ] + RUNTIME_NPM_DEPS,
    entry_point = "//src:bzlgen.ts",
    tags = ["manual"],
)
