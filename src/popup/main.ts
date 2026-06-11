import '../ui/styles/theme.css';
import { mount } from 'svelte';
import Popup from './Popup.svelte';

const target = document.getElementById('app')!;
const app = mount(Popup, { target });

export default app;
