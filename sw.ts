type ComponentDefinition = (abilities: Abilities) => Promise<HTMLElement>;
type Component = (scope?: string | null) => Promise<ComponentInstance>;
type ComponentInstance = HTMLElement;
type ListenerCallbackMap = Map<ComponentInstance, Set<(data: any, notifier: ComponentInstance) => any>>;
type ScopedEvent = {
    eventName: string;
    room: string | null;
}
type Abilities = {
    readonly id: number;
    readonly room: string | null;
    changeRoom(newRoom: string | null): void;
    whisper(target: ComponentInstance, eventName: string, data: any): void;
    shout(eventName: string, data: any): void;
    broadcast(eventName: string, data: any): void;
    listen(eventName: string, callback: (data: any, speaker: ComponentInstance) => any): void;
    ignore(eventName: string): void;
    destroy(): void;
};

export { ComponentDefinition, Component, ComponentInstance, ScopedEvent };

// Registers instances, instances must return elements
const COMPONENTMAP: Map<Component, Set<ComponentInstance>> = new Map();
// component instance ID to the instance
const IDMAP: Map<number, ComponentInstance> = new Map();
// Registers to each event a map of instances where each instance has a set of callbacks
const EVENTMAP: Map<string, ListenerCallbackMap> = new Map();
// Each instance gets a unique id by increment
let INSTANCEIDCOUNT = -1;

// Listen for a message and fire a callback
const LISTEN = (eventName: string, callback: (data: any, notifier: ComponentInstance) => any, self: ComponentInstance) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (listenerCallbackMap) {
        const callbacks = listenerCallbackMap.get(self);
        if (callbacks) {
            callbacks.add(callback);
        }
        else {
            const callbacks = new Set<(data: any, notifier: any) => any>();
            callbacks.add(callback);
            listenerCallbackMap.set(self, callbacks);
        }
    }
    else {
        const listenerCallbackMap: ListenerCallbackMap = new Map();
        const callbacks = new Set<(data: any, notifier: any) => any>();
        callbacks.add(callback);
        listenerCallbackMap.set(self, callbacks);
        EVENTMAP.set(eventName, listenerCallbackMap);
    }
};

// Listen for a message one time
const LISTENONCE = (eventName: string, callback: (data: any, notifier: ComponentInstance) => any, self: ComponentInstance) => {

};

// Stop listening to a message
const IGNORE = (eventName: string, self: ComponentInstance) => {
    EVENTMAP.get(eventName)?.delete(self);
};


// Message every instance and ignore scope
const BROADCAST = (eventName: string, data: any, notifier: ComponentInstance) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (!listenerCallbackMap) return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const callback of callbackSet) {
            callback(data, notifier);
        }
    });
};

// Message every instance in scope
const SHOUT = (eventName: string, data: any, speaker: ComponentInstance) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (!listenerCallbackMap) return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const callback of callbackSet) {
            callback(data, speaker);
        }
    });
};

// Message one instance
const WHISPER = (target: ComponentInstance, eventName: string, data: any, speaker: ComponentInstance) => {
    const callbackSet = EVENTMAP.get(eventName)?.get(target);
    if (!callbackSet) return;
    for (const callback of callbackSet) {
        callback(data, speaker);
    }
};

// Set a persistent message that can be picked up at any time.
// Can be heard after it is fired.
// Can be modified later, which will refire callbacks
// Unscoped? Could also have scope for this and an unscoped version (Billboard)
const ECHO = (eventName: string, data: any, notifier: ComponentInstance) => {

};

const defineComponent = (componentFn: ComponentDefinition) => {
    const instanceSet = new Set<HTMLElement>();
    const createInstance: Component = async (room: string | null = null) => {
        let isMounting = true;
        //let element: HTMLElement;
        INSTANCEIDCOUNT++;
        const instanceId = INSTANCEIDCOUNT;

        // We are using a Promise to resolve a circular dependency.
        // In order for the methods like listen() to work, they need the component instance to finish firing and return its value, element.
        // But the methods are available inside the component instance and can be fired immediately, and need to pass in element for them to work.
        // So the promise is there to force the methods to wait for the instance to finish returning before they can fire.
        // Otherwise, "element" here is undefined and this breaks.
        // The method might not be fired immediately though, so we add a boolean check to see if the component instance has returned already.

        // This is pretty new - Baseline 2024. Allows access to the resolver from outside. 
        // Not needed but better than the old way to do this
        const { promise: getElement,
            resolve: resolveElement,
            reject: rejectElement
        } = Promise.withResolvers<HTMLElement>();

        const fireAbility = (fn: (...args: any[]) => any, ...args: any[]) => {
            if (isMounting) {
                getElement.then(element => fn(...args, element, room));
            }
            else {
                fn(...args, element, room);
            }
        };

        const abilities: Abilities = {
            get id() {
                return instanceId;
            },
            get room() {
                return room;
            },
            changeRoom(newRoom: string | null) {
                room = newRoom || null;
            },
            whisper(target: ComponentInstance, eventName: string, data: any) {
                fireAbility(WHISPER, target, eventName, data);
            },
            shout(eventName: string, data: any) {
                fireAbility(SHOUT, eventName, data);
            },
            broadcast(eventName: string, data: any) {
                fireAbility(BROADCAST, eventName, data);
            },
            listen(eventName: string, callback: (data: any, notifier: ComponentInstance) => any) {
                fireAbility(LISTEN, eventName, callback);
            },
            ignore(eventName: string) {
                fireAbility(IGNORE, eventName, element);
            },
            destroy() {
                // Delete from maps and null stuff out
            }
        };
        Object.freeze(abilities);
        const element = await componentFn(abilities);
        if (!(element instanceof HTMLElement)) {
            rejectElement();
            throw new Error(`Component definition must be async and must return an HTMLElement.`);
        }

        IDMAP.set(instanceId, element);
        instanceSet.add(element);

        element.dataset.swId = String(instanceId);
        if (room) {
            element.dataset.swRoom = String(room ?? '');
        }
        else {
            delete element.dataset.swRoom;
        }

        resolveElement(element);
        isMounting = false;
        return element;
    };
    COMPONENTMAP.set(createInstance, instanceSet);

    return createInstance;
};

const getInstances = (componentFn: Component) => {
    return COMPONENTMAP.get(componentFn);
}
const clearEvent = (eventName: string) => {
    EVENTMAP.delete(eventName);
};
const hasEvent = (eventName: string) => {
    return EVENTMAP.has(eventName);
};


const sw = {
    defineComponent: defineComponent,
    get components() {
        // Doesn't really make sense right now because we aren't storing the name
        // anonymous function makes this basically impossible
        return [...COMPONENTMAP.keys()];
    },
    getInstances,
    getInstanceById(id: number) {
        return IDMAP.get(id);
    },
    get events() {
        return [...EVENTMAP.keys()];
    },
    clearEvent,
    hasEvent,
};


Object.freeze(sw);
export default sw;






