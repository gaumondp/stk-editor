import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';

const root = document.getElementById('app');

if (root) {
	mount(App, { target: root });
}