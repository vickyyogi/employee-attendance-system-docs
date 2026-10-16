allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Workaround for camera_android_camerax: camera-core 1.5.3 declares
// androidx.concurrent:concurrent-futures as runtime-only, but javac needs
// CallbackToFutureAdapter on the compile classpath (SurfaceRequest type
// annotations) when compiling the plugin. Remove once camera_android_camerax
// ships a CameraX release with a compile-scoped dependency.
subprojects {
    if (name == "camera_android_camerax") {
        val addWorkaroundDependency = {
            dependencies.add("implementation", "androidx.concurrent:concurrent-futures:1.1.0")
        }
        // The project may already be evaluated (see evaluationDependsOn above),
        // so only defer to afterEvaluate when it has not run yet.
        if (state.executed) {
            addWorkaroundDependency()
        } else {
            afterEvaluate { addWorkaroundDependency() }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
