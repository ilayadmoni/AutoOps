import { useContext } from 'react';
import { ThemeContext } from '../app/providers/ThemeProvider';

export const useTheme = () => useContext(ThemeContext);
