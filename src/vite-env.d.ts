/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly APP_VERSION: string;
	readonly APP_BUILD_TIME: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
