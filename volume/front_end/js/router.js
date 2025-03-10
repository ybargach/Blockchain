export class Router {
    constructor() {
        this.routes = {};
        this.currentPath = '';
        
        window.addEventListener('hashchange', () => {
            this.handleRoute(window.location.hash);
        });
    }

    addRoute(path, handler) {
        const cleanPath = path.replace('#', '');
        this.routes[cleanPath] = handler;
    }

    navigate(path) {
        const hashPath = path.startsWith('#') ? path : '#' + path;
        window.location.hash = hashPath;
    }

    handleRoute(hash) {
        console.log('Handling route:', hash);
        // Split the hash to get the path and query parameters
        const [hashPath, queryString] = hash.replace('#', '').split('?');
        const path = hashPath || '/';
        this.currentPath = path;
        
        // Parse query parameters if they exist
        this.queryParams = {};
        if (queryString) {
            const params = new URLSearchParams(queryString);
            params.forEach((value, key) => {
                this.queryParams[key] = value;
            });
        }
        
        const handler = this.routes[path];
        
        if (handler) {
            handler();
        } else {
            this.navigate('/');
        }
    }
    
    getQueryParam(name) {
        return this.queryParams ? this.queryParams[name] : null;
    }

    start() {
        this.handleRoute(window.location.hash);
    }
}