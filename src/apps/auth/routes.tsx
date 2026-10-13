/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { Route } from 'react-router-dom'
import Login from './pages/Login'

/** Sign-in for every staff role. */
export const authRoutes = <Route path="/login" element={<Login />} />
