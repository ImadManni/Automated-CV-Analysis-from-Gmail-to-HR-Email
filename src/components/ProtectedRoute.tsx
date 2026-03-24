import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Optional: require one of these roles (Keycloak or backend). Empty = no role check. */
  roles?: string[]
}

/**
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 * Si roles est défini, exige au moins un des rôles (sinon redirige vers /login).
 */
export function ProtectedRoute({ children, roles: requiredRoles }: ProtectedRouteProps) {
  const token = useAppSelector((s) => s.auth.token)
  const userRoles = useAppSelector((s) => s.auth.roles)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (Array.isArray(requiredRoles) && requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((r) => userRoles.includes(r))
    if (!hasRole) {
      return <Navigate to="/login" state={{ from: location, message: 'Accès refusé (rôle requis)' }} replace />
    }
  }

  return <>{children}</>
}
