import { auth } from "@/auth"
import { NextRequest, NextResponse } from 'next/server'
 
// Protected and public routes
const protectedRoutes = ['/heuristic']
const publicRoutes = ['/login', '/signup', '/']
 
export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.includes(path)
  const isPublicRoute = publicRoutes.includes(path)
 
  const session = await auth();
 
  // Redirect to / if the user is not authenticated
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  // if (
  //   isPublicRoute &&
  //   session &&
  //   !req.nextUrl.pathname.startsWith('/heuristic')
  // ) {
  //   return NextResponse.redirect(new URL('/heuristic', req.nextUrl))
  // }
 
  return NextResponse.next()
}
 
// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}