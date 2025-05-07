type ComponentDefinition = (abilities: Abilities, props?: Record<string, any>) => Promise<HTMLElement>;
type Component = (props?: Record<string, any>) => Promise<ComponentInstance>;
type ComponentInstance = HTMLElement;
type MessageCallback = (data: any, speaker: ComponentInstance, speechType: SpeechType) => any;
type MessageCallbackWithMetadata = {
    callback: MessageCallback;
    topic: string; // Unused at the moment
    timesCalled: number;
    maxTimes: number | null;
}
type ListenerCallbackMap = Map<ComponentInstance, Set<MessageCallbackWithMetadata>>;

type ComponentInstanceWithMetadata = {
    element: ComponentInstance;
    // topicCallbacks: Map<string, Set<MessageCallback>>;
    readonly id: number;
    readonly room: string;
}


// Possibly introduce sw.Controller that is a separate type of component without a dom representation, that can fire internals on behalf of anything

type Abilities = Readonly<{
    getId(): number;
    getRoom(): { name: string; roommates: ComponentInstance[] };
    setRoom(newRoom: string): void;
    listen(topic: string, callback: MessageCallback, numberOfTimes?: number): void;
    ignore(topic: string): void;
    deafen(): void;
    whisper(target: ComponentInstance, topic: string, data: any): void;
    shout(topic: string, data: any): void;
    broadcast(topic: string, data: any): void;
    echo(topic: string, data: any): void;
    destroy(): void;
    //impersonate(): Abilities;
    //track(component: ComponentInstance): void;
}>;

type SpeechType = 'whisper' | 'shout' | 'broadcast' | 'echo';

export { ComponentDefinition, Component, ComponentInstance };

// Registers to each topic a map of instances where each instance has a set of callbacks
// All messages go through this
const TOPICMAP: Map<string, ListenerCallbackMap> = new Map();
// Saves a set of instances created with each factory
const INSTANCES: Record<string, ComponentInstanceWithMetadata[]> = {};
// Store the metadata

const COMPONENTS: Record<string, Component> = {};
// Set of components per room
const ROOMMAP: Map<string, Set<ComponentInstance>> = new Map();
// Set of active topics per instance
const LISTENINGMAP: Map<ComponentInstance, Set<string>> = new Map();
// Component instance ID to the instance
const IDMAP: Map<number, ComponentInstance> = new Map();
// Each instance gets a unique id by increment
let INSTANCEIDCOUNT = 0;

// const ECHOMAP: Map<
//     { room: string; topic: string; },
//     { data: any, speaker: ComponentInstance, speechType: 'echo' }
// > = new Map();

// Allow access to an instance's internals from outside
const ABILITYMAP: Map<ComponentInstance, Abilities> = new Map();

// Listen to a topic and fire a callback when receiving a message
const LISTEN = (topic: string, callbackWithMetadata: MessageCallbackWithMetadata, self: ComponentInstance) => {

    const listenerCallbackMap = TOPICMAP.get(topic);
    if (listenerCallbackMap) {
        const callbackObject = listenerCallbackMap.get(self);
        if (callbackObject) {
            callbackObject.add(callbackWithMetadata);
        }
        else {
            const callbacks = new Set<MessageCallbackWithMetadata>();
            callbacks.add(callbackWithMetadata);
            listenerCallbackMap.set(self, callbacks);
        }
    }
    else {
        const listenerCallbackMap: ListenerCallbackMap = new Map();
        const callbacks = new Set<MessageCallbackWithMetadata>();
        callbacks.add(callbackWithMetadata);
        listenerCallbackMap.set(self, callbacks);
        TOPICMAP.set(topic, listenerCallbackMap);
    }

    // Trigger echo
    // const latestEcho = ECHOMAP.get(topic);
    // if (!latestEcho) return;
    // if 

};

// Stop listening to a topic
const IGNORE = (topic: string, self: ComponentInstance) => {
    TOPICMAP.get(topic)?.delete(self);
    LISTENINGMAP.get(self)?.delete(topic);
};

// Ignore everything
const DEAFEN = (self: ComponentInstance) => {

};

// Message the topic in every room
const BROADCAST = (topic: string, data: any, speaker: ComponentInstance) => {
    const listenerCallbackMap = TOPICMAP.get(topic);
    if (!listenerCallbackMap) return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const item of callbackSet) {
            if (item.maxTimes !== null && item.timesCalled >= item.maxTimes) continue;
            item.timesCalled++;
            item.callback(data, speaker, 'broadcast');
        }
    });
};

// Message the topic in the room. Can't be heard in other rooms
const SHOUT = (topic: string, data: any, speaker: ComponentInstance, room: string) => {
    const listenerCallbackMap = TOPICMAP.get(topic);
    if (!listenerCallbackMap) return;
    for (const [listener, callbackSet] of listenerCallbackMap) {
        if (isInRoom(listener, room)) {
            for (const item of callbackSet) {
                if (item.maxTimes !== null && item.timesCalled >= item.maxTimes) continue;
                item.timesCalled++;
                item.callback(data, speaker, 'shout');
            }
        }
    };
};

// Message one specific target instance by reference. Can't be heard across rooms
const WHISPER = (target: ComponentInstance, topic: string, data: any, speaker: ComponentInstance, room: string) => {
    if (!isInRoom(target, room)) return;
    const callbackSet = TOPICMAP.get(topic)?.get(target);
    if (!callbackSet) return;
    for (const item of callbackSet) {
        if (item.maxTimes !== null && item.timesCalled >= item.maxTimes) continue;
        item.timesCalled++;
        item.callback(data, speaker, 'whisper');
    }
};

// Set a persistent message on a topic that can be picked up at any time.
// This is different from other events in that it can be listened to after it is fired.
// Echoing again on the same topic refires callbacks for all listeners.
// Can't be heard across rooms

const ECHO = (topic: string, data: any, speaker: ComponentInstance, room: string) => {
    // Could echo fire a whisper any time a new listener is added?
};

const checkForEchoes = (topic: string, callback: (data: any, speaker: ComponentInstance, speechType: SpeechType) => any, self: ComponentInstance) => {
    // Listen has to go here first
    // const listenerCallbackMap = topicCALLBACKMAP.get(topic);
    // if (!listenerCallbackMap) return;
    // for (const [listener, callbackSet] of listenerCallbackMap) {
    //     if (isInRoom(listener, room)) {
    //         for (const callback of callbackSet) {
    //             callback(data, speaker, 'shout');
    //         }
    //     }
    // };
};

const areInSameRoom = (componentInstance1: ComponentInstance, componentInstance2: ComponentInstance) => {
    // Don't really need this
    const room = getAbilities(componentInstance1)?.getRoom().name;
    return !!room && room === getAbilities(componentInstance2)?.getRoom().name;
};

const isInRoom = (componentInstance: ComponentInstance, room: string) => {
    return ROOMMAP.get(room)?.has(componentInstance) ?? false;
};

const enterRoom = (room: string, componentInstance: ComponentInstance) => {
    const instanceSet = ROOMMAP.get(room);
    if (instanceSet) {
        instanceSet.add(componentInstance);
    }
    else {
        const instanceSet: Set<ComponentInstance> = new Set();
        instanceSet.add(componentInstance);
        ROOMMAP.set(room, instanceSet);
    }
    componentInstance.dataset.swRoom = room ?? '';
};

const leaveRoom = (room: string, componentInstance: ComponentInstance) => {
    ROOMMAP.get(room)?.delete(componentInstance);
    componentInstance.dataset.swRoom = '';
};

const define = (componentFn: ComponentDefinition) => {
    if (typeof componentFn !== 'function' || !componentFn.name) {
        throw new Error(`Component definition must use a named function: async function ComponentName()`);
    }
    if (componentFn.constructor.name !== 'AsyncFunction') {
        throw new Error(`Component definition must be async.`);
    }
    const build: Component = async (props?: Record<string, any>) => {
        let isMounting = true;
        const instanceId = INSTANCEIDCOUNT++;
        let room = '';

        // We are using a Promise to resolve a circular dependency.
        // In order for the methods like listen() to work, they need the component instance to finish firing and return its value, element.
        // But the methods are available inside the component instance and can be fired immediately, and need to pass in element for them to work.
        // So the promise is there to force the methods to wait for the instance to finish returning before they can fire.
        // Otherwise, "element" here is undefined and this breaks.
        // The method might not be fired immediately though, so we check isMounting to see if the component instance has returned already.

        // withResolvers is pretty new - Baseline 2024. Allows access to the resolver from outside. 
        // Not needed but better than the old way to do this
        const { promise: getElement,
            resolve: resolveElement,
            reject: rejectElement
        } = Promise.withResolvers<HTMLElement>();

        const fire = (fn: (...args: any[]) => any, ...args: any[]) => {
            // Safely fires if the component hasn't mounted yet
            // Passes in instance and room as extra arguments
            if (isMounting) {
                getElement.then(element => fn(...args, element, room));
            }
            else {
                fn(...args, element, room);
            }
        };

        // If we could make these accessible from outside that would be interesting
        const abilities: Abilities = Object.freeze({
            getId() {
                return instanceId;
            },
            getRoom() {
                return {
                    name: room,
                    roommates: [...ROOMMAP.get(room) ?? []]
                }
            },
            setRoom(newRoom: string) {
                fire(leaveRoom, room);
                room = newRoom;
                fire(enterRoom, room);
            },
            getListeningTo() {
                // Not good
                // If you fire this during mount, element won't exist
                // Currently not working
                return LISTENINGMAP.get(element) as Set<string>;
            },
            whisper(target: ComponentInstance, topic: string, data: any) {
                fire(WHISPER, target, topic, data);
            },
            shout(topic: string, data: any) {
                fire(SHOUT, topic, data);
            },
            broadcast(topic: string, data: any) {
                fire(BROADCAST, topic, data);
            },
            echo(topic: string, data: any) {

            },
            listen(topic: string, callback: MessageCallback, numberOfTimes?: number) {
                const metadata: MessageCallbackWithMetadata = {
                    callback,
                    topic,
                    timesCalled: 0,
                    maxTimes: numberOfTimes || null
                };
                fire(LISTEN, topic, metadata);
            },
            ignore(topic: string) {
                fire(IGNORE, topic, element);
            },
            deafen() {

            },
            destroy() {
                this.deafen();
                // Delete from maps and null stuff out
            }
        });

        const element = await componentFn(abilities, props);
        if (!(element instanceof HTMLElement)) {
            rejectElement();
            throw new Error(`Component definition must return an HTMLElement.`);
        }

        const metadata: ComponentInstanceWithMetadata = {
            element,
            get room() {
                return room;
            },
            get id() {
                return instanceId;
            }
        };

        INSTANCES[componentFn.name]?.push(metadata);
        element.dataset.swId = String(instanceId);
        IDMAP.set(instanceId, element);
        LISTENINGMAP.set(element, new Set());
        ABILITYMAP.set(element, abilities);
        enterRoom(room, element);

        resolveElement(element);

        isMounting = false;
        return element;
    };

    INSTANCES[componentFn.name] = [];
    COMPONENTS[componentFn.name] = build;

}

const getAbilities = (componentInstance: ComponentInstance) => {
    // Retrieve the internals for an instance.
    // This is interesting because it allows outside access to instance id, room, methods, etc.,
    // while still allowing us to use plain unmodified HTMLElements directly, without wrapping them in objects
    // Opens up the possibility of an impersonate() ability,
    // where components fire other components' abilties but leave some audit trail
    // Although this leads to some insane complexity and breaks encapsulation
    return ABILITYMAP.get(componentInstance);
};

const getInstancesByRoom = (room: string) => {
    const x: any = {};
    for (const key in INSTANCES) {
        const instances = INSTANCES[key].filter(item => item.room === room);
        if (instances.length) {
            x[key] = instances;
        }
    }
    return x;
};



const sw = Object.freeze({
    components() {
        return {...COMPONENTS};
    },
    define,
    build(componentName: string, props?: Record<string, any>) {
        if (typeof COMPONENTS[componentName] !== 'function') throw new Error(`Component "${componentName}" isn't defined.`);
        return COMPONENTS[componentName](props);
    },
    find(query: { component: string, room: string }) {
        if (!query) return;
        if (typeof query.component === 'undefined' && typeof query.room === 'undefined') return;
        if (typeof query.room === 'undefined') return INSTANCES[query.component];
        if (typeof query.component === 'undefined') {
            return getInstancesByRoom(query.room);
        }
        // Return by both here
    },
    // getInstanceById(id: number): ComponentInstance | undefined {
    //     return IDMAP.get(id);
    // },
    // getTopics(): string[] {
    //     return [...TOPICMAP.keys()];
    // },
    // deleteTopic(topic: string): void {
    //     TOPICMAP.delete(topic);
    // },
    // topicExists(topic: string): boolean {
    //     return TOPICMAP.has(topic);
    // },
});

export default sw;