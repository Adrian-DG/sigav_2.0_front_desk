# SiGAV Front Desk

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.1.

## Development server

La app apunta al backend (`Backend/`, ver su propio README) según uno de tres ambientes, cada uno
con su `src/environments/environment.*.ts` (swapped en build con `fileReplacements`, ver `angular.json`):

```bash
yarn start:local   # http://localhost:5282/api — backend corriendo en esta misma PC
yarn start:tunnel   # Dev Tunnel de Visual Studio — backend expuesto para probar desde otra red
yarn start:prod     # API de producción (una vez desplegada)
```

- **local**: usa `src/environments/environment.ts`, ya en el repo con `http://localhost:5282/api`. Requiere la API corriendo en local (`dotnet run` en `Backend/Presentation`).
- **dev-tunnel**: usa `src/environments/environment.dev-tunnel.ts`. Ese archivo está gitignorado (la URL del túnel es de cada PC y cambia); créelo con:
  ```ts
  export const environment = {
    production: false,
    apiUrl: 'https://<su-dev-tunnel>.devtunnels.ms/api',
  };
  ```
  Es el mismo Dev Tunnel que usa `Mobile/.env.local` (`EXPO_PUBLIC_API_URL_DEV_TUNNEL`): si ya lo tiene corriendo para el móvil, reutilice esa URL.
- **production**: usa `src/environments/environment.production.ts` (en el repo, con `apiUrl` vacío hasta que exista un despliegue).

En cualquier caso, la API debe permitir el origen `http://localhost:4200` en `Cors:AllowedOrigins`
(`Backend/Presentation/appsettings.Development.json`); ya está agregado para desarrollo.

También puede usar el comando estándar de Angular directamente (apunta a `environment.ts`, igual que `start:local`):

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
