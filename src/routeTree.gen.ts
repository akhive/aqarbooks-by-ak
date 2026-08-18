/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginRouteImport } from './routes/login'
import { Route as ChequesRouteImport } from './routes/cheques'
import { Route as ReportsRouteImport } from './routes/reports'
import { Route as TenantsRouteImport } from './routes/tenants'
import { Route as UnitsRouteImport } from './routes/units'
import { Route as ContractsRouteImport } from './routes/contracts'
import { Route as ContractContractIdRouteImport } from './routes/contract.$contractId'
import { Route as ExpensesRouteImport } from './routes/expenses'
import { Route as ReconciliationRouteImport } from './routes/reconciliation'
import { Route as BackupRouteImport } from './routes/backup'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)

const ChequesRoute = ChequesRouteImport.update({
  id: '/cheques',
  path: '/cheques',
  getParentRoute: () => rootRouteImport,
} as any)

const ReportsRoute = ReportsRouteImport.update({
  id: '/reports',
  path: '/reports',
  getParentRoute: () => rootRouteImport,
} as any)

const TenantsRoute = TenantsRouteImport.update({
  id: '/tenants',
  path: '/tenants',
  getParentRoute: () => rootRouteImport,
} as any)

const UnitsRoute = UnitsRouteImport.update({
  id: '/units',
  path: '/units',
  getParentRoute: () => rootRouteImport,
} as any)

const ContractsRoute = ContractsRouteImport.update({
  id: '/contracts',
  path: '/contracts',
  getParentRoute: () => rootRouteImport,
} as any)

const ContractContractIdRoute = ContractContractIdRouteImport.update({
  id: '/contract/$contractId',
  path: '/contract/$contractId',
  getParentRoute: () => rootRouteImport,
} as any)

const ExpensesRoute = ExpensesRouteImport.update({
  id: '/expenses',
  path: '/expenses',
  getParentRoute: () => rootRouteImport,
} as any)

const ReconciliationRoute = ReconciliationRouteImport.update({
  id: '/reconciliation',
  path: '/reconciliation',
  getParentRoute: () => rootRouteImport,
} as any)

const BackupRoute = BackupRouteImport.update({
  id: '/backup',
  path: '/backup',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/cheques': typeof ChequesRoute
  '/reports': typeof ReportsRoute
  '/tenants': typeof TenantsRoute
  '/units': typeof UnitsRoute
  '/contracts': typeof ContractsRoute
  '/contract/$contractId': typeof ContractContractIdRoute
  '/expenses': typeof ExpensesRoute
  '/reconciliation': typeof ReconciliationRoute
  '/backup': typeof BackupRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/cheques': typeof ChequesRoute
  '/reports': typeof ReportsRoute
  '/tenants': typeof TenantsRoute
  '/units': typeof UnitsRoute
  '/contracts': typeof ContractsRoute
  '/contract/$contractId': typeof ContractContractIdRoute
  '/expenses': typeof ExpensesRoute
  '/reconciliation': typeof ReconciliationRoute
  '/backup': typeof BackupRoute
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/cheques': typeof ChequesRoute
  '/reports': typeof ReportsRoute
  '/tenants': typeof TenantsRoute
  '/units': typeof UnitsRoute
  '/contracts': typeof ContractsRoute
  '/contract/$contractId': typeof ContractContractIdRoute
  '/expenses': typeof ExpensesRoute
  '/reconciliation': typeof ReconciliationRoute
  '/backup': typeof BackupRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/login'
    | '/cheques'
    | '/reports'
    | '/tenants'
    | '/units'
    | '/contracts'
    | '/contract/$contractId'
    | '/expenses'
    | '/reconciliation'
    | '/backup'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/login'
    | '/cheques'
    | '/reports'
    | '/tenants'
    | '/units'
    | '/contracts'
    | '/contract/$contractId'
    | '/expenses'
    | '/reconciliation'
    | '/backup'
  id:
    | '__root__'
    | '/'
    | '/login'
    | '/cheques'
    | '/reports'
    | '/tenants'
    | '/units'
    | '/contracts'
    | '/contract/$contractId'
    | '/expenses'
    | '/reconciliation'
    | '/backup'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  ChequesRoute: typeof ChequesRoute
  ReportsRoute: typeof ReportsRoute
  TenantsRoute: typeof TenantsRoute
  UnitsRoute: typeof UnitsRoute
  ContractsRoute: typeof ContractsRoute
  ContractContractIdRoute: typeof ContractContractIdRoute
  ExpensesRoute: typeof ExpensesRoute
  ReconciliationRoute: typeof ReconciliationRoute
  BackupRoute: typeof BackupRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/cheques': {
      id: '/cheques'
      path: '/cheques'
      fullPath: '/cheques'
      preLoaderRoute: typeof ChequesRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/reports': {
      id: '/reports'
      path: '/reports'
      fullPath: '/reports'
      preLoaderRoute: typeof ReportsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/tenants': {
      id: '/tenants'
      path: '/tenants'
      fullPath: '/tenants'
      preLoaderRoute: typeof TenantsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/units': {
      id: '/units'
      path: '/units'
      fullPath: '/units'
      preLoaderRoute: typeof UnitsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/contracts': {
      id: '/contracts'
      path: '/contracts'
      fullPath: '/contracts'
      preLoaderRoute: typeof ContractsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/contract/$contractId': {
      id: '/contract/$contractId'
      path: '/contract/$contractId'
      fullPath: '/contract/$contractId'
      preLoaderRoute: typeof ContractContractIdRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/expenses': {
      id: '/expenses'
      path: '/expenses'
      fullPath: '/expenses'
      preLoaderRoute: typeof ExpensesRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/reconciliation': {
      id: '/reconciliation'
      path: '/reconciliation'
      fullPath: '/reconciliation'
      preLoaderRoute: typeof ReconciliationRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/backup': {
      id: '/backup'
      path: '/backup'
      fullPath: '/backup'
      preLoaderRoute: typeof BackupRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LoginRoute: LoginRoute,
  ChequesRoute: ChequesRoute,
  ReportsRoute: ReportsRoute,
  TenantsRoute: TenantsRoute,
  UnitsRoute: UnitsRoute,
  ContractsRoute: ContractsRoute,
  ContractContractIdRoute: ContractContractIdRoute,
  ExpensesRoute: ExpensesRoute,
  ReconciliationRoute: ReconciliationRoute,
  BackupRoute: BackupRoute,
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
