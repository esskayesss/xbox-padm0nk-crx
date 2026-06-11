import '../ui/styles/theme.css';
import { mount } from 'svelte';
import Options from './Options.svelte';

const target = document.getElementById('app')!;
const app = mount(Options, { target });

export default app;
