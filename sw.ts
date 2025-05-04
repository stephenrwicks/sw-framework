type ComponentDefinition = (abilities: Abilities) => Promise<HTMLElement>;
type Component = (room: string) => Promise<ComponentInstance>;
type ComponentInstance = HTMLElement;
type MessageCallback = (data: any, speaker: ComponentInstance, speechType: SpeechType) => any;

type ListenerCallbackMap = Map<ComponentInstance, Set<MessageCallback>>;


// Objects I might want to switch to later:

type ComponentInstanceWithMetadata = {
    instance: ComponentInstance;
    channelCallbacks: Map<string, Set<MessageCallback>>;
    readonly id: number;
    readonly room: string;
}

type MessageCallbackWithMetadata = {
    messageCallback: MessageCallback;
    times?: number;   
}


type Abilities = Readonly<{
    readonly id: number;
    readonly room: string;
    changeRoom(newRoom: string): void;
    whisper(target: ComponentInstance, channel: string, data: any): void;
    shout(channel: string, data: any): void;
    broadcast(channel: string, data: any): void;
    echo(channel: string, data: any): void;
    listen(channel: string, callback: MessageCallback): void;
    ignore(channel: string): void;
    deafen(): void;
    destroy(): void;
}>;

type SpeechType = 'whisper' | 'shout' | 'broadcast' | 'echo';

export { ComponentDefinition, Component, ComponentInstance };

// Registers to each channel a map of instances where each instance has a set of callbacks
// All messages go through this
const CHANNELCALLBACKMAP: Map<string, ListenerCallbackMap> = new Map();

const ONETIMECALLBACKSET: Set<MessageCallback> = new Set();

// Saves a set of instances created with each factory
const COMPONENTMAP: Map<Component, Set<ComponentInstance>> = new Map();
// Set of components per room
const ROOMMAP: Map<string, Set<ComponentInstance>> = new Map();
// Set of active channels per instance
const LISTENINGMAP: Map<ComponentInstance, Set<string>> = new Map();
// Component instance ID to the instance
const IDMAP: Map<number, ComponentInstance> = new Map();
// Each instance gets a unique id by increment
let INSTANCEIDCOUNT = -1;

// Allow access to an instance's internals from outside
const ABILITYMAP: Map<ComponentInstance, Abilities> = new Map();

// Listen to a channel and fire a callback when receiving a message
const LISTEN = (channel: string, callback: MessageCallback, self: ComponentInstance) => {

    const echoSet = ECHOMAP.get(channel);


    const listenerCallbackMap = CHANNELCALLBACKMAP.get(channel);
    if (listenerCallbackMap) {
        const callbackObject = listenerCallbackMap.get(self);
        if (callbackObject) {
            callbackObject.add(callback);
        }
        else {
            const callbacks = new Set<MessageCallback>();
            callbacks.add(callback);
            listenerCallbackMap.set(self, callbacks);
        }
    }
    else {
        const listenerCallbackMap: ListenerCallbackMap = new Map();
        const callbacks = new Set<MessageCallback>();
        callbacks.add(callback);
        listenerCallbackMap.set(self, callbacks);
        CHANNELCALLBACKMAP.set(channel, listenerCallbackMap);
    }
};

// Listen to a channel and fire the callback one time only
const LISTENONCE = (channel: string, callback: MessageCallback, self: ComponentInstance) => {
    ONETIMECALLBACKSET.add(callback);
    LISTEN(channel, callback, self);
};

// Stop listening to a channel
const IGNORE = (channel: string, self: ComponentInstance) => {
    CHANNELCALLBACKMAP.get(channel)?.delete(self);
    LISTENINGMAP.get(self)?.delete(channel);
};

// Ignore everything
const DEAFEN = (self: ComponentInstance) => {

};


// Message the channel in every room
const BROADCAST = (channel: string, data: any, speaker: ComponentInstance) => {
    const listenerCallbackMap = CHANNELCALLBACKMAP.get(channel);
    if (!listenerCallbackMap) return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const callback of callbackSet) {
            ONETIMECALLBACKSET.delete(callback);
            callback(data, speaker, 'broadcast');
        }
    });
};

// Message the channel in the room. Can't be heard in other rooms
const SHOUT = (channel: string, data: any, speaker: ComponentInstance, room: string) => {
    const listenerCallbackMap = CHANNELCALLBACKMAP.get(channel);
    if (!listenerCallbackMap) return;
    for (const [listener, callbackSet] of listenerCallbackMap) {
        if (isInRoom(listener, room)) {
            for (const callback of callbackSet) {
                ONETIMECALLBACKSET.delete(callback);
                callback(data, speaker, 'shout');
            }
        }
    };
};

// Message one specific target instance by reference. Can't be heard across rooms
const WHISPER = (target: ComponentInstance, channel: string, data: any, speaker: ComponentInstance, room: string) => {
    if (!isInRoom(target, room)) return;
    const callbackSet = CHANNELCALLBACKMAP.get(channel)?.get(target);
    if (!callbackSet) return;
    for (const callback of callbackSet) {
        ONETIMECALLBACKSET.delete(callback);
        callback(data, speaker, 'whisper');
    }
};

// Set a persistent message on a channel that can be picked up at any time.
// This is different from other events in that it can be listened to after it is fired.
// Echoing again on the same channel refires callbacks for all listeners.
// Can't be heard across rooms
const ECHOMAP: Map<string, MessageCallback> = new Map();
const ECHO = (channel: string, data: any, speaker: ComponentInstance, room: string) => {
    // Could echo fire a whisper any time a new listener is added?
};

const checkForEchoes = (channel: string, callback: (data: any, speaker: ComponentInstance, speechType: SpeechType) => any, self: ComponentInstance) => {
    // Listen has to go here first
    // const listenerCallbackMap = CHANNELCALLBACKMAP.get(channel);
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
    // Don't really need this, maybe a little easier
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

const defineComponent = (componentFn: ComponentDefinition) => {
    const instanceSet = new Set<ComponentInstance>();
    const createInstance: Component = async (room: string) => {
        let isMounting = true;
        //let element: HTMLElement;
        INSTANCEIDCOUNT++;
        const instanceId = INSTANCEIDCOUNT;

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
            get id() {
                return instanceId;
            },
            get room() {
                return room;
            },
            changeRoom(newRoom: string) {
                fire(leaveRoom, room)
                room = newRoom;
                fire(enterRoom, room);
            },
            getListeningTo() {
                // Not good
                // If you fire this during mount, element won't exist
                // Currently not working
                return LISTENINGMAP.get(element) as Set<string>;
            },
            whisper(target: ComponentInstance, channel: string, data: any) {
                fire(WHISPER, target, channel, data);
            },
            shout(channel: string, data: any) {
                fire(SHOUT, channel, data);
            },
            broadcast(channel: string, data: any) {
                fire(BROADCAST, channel, data);
            },
            echo(channel: string, data: any) {

            },
            listen(channel: string, callback: MessageCallback) {
                fire(LISTEN, channel, callback);
            },
            listenOnce(channel: string, callback: MessageCallback) {
                fire(LISTENONCE, channel, callback);
            },
            ignore(channel: string) {
                fire(IGNORE, channel, element);
            },
            deafen() {

            },
            destroy() {
                // Delete from maps and null stuff out
            }
        });
        const element = await componentFn(abilities);
        if (!(element instanceof HTMLElement)) {
            rejectElement();
            throw new Error(`Component definition must be async and must return an HTMLElement.`);
        }

        IDMAP.set(instanceId, element);
        instanceSet.add(element);
        element.dataset.swId = String(instanceId);

        enterRoom(room, element);

        LISTENINGMAP.set(element, new Set());

        ABILITYMAP.set(element, abilities);

        // Check for echoes here?

        resolveElement(element);

        isMounting = false;
        return element;
    };
    COMPONENTMAP.set(createInstance, instanceSet);
    return createInstance;
};

const sw = Object.freeze({
    defineComponent: defineComponent,
    get components(): Component[] {
        // Doesn't really make sense right now because we aren't storing the name,
        // so everything is called createInstance
        // Anonymous function makes name storing basically impossible
        return [...COMPONENTMAP.keys()];
    },
    getInstances(componentFn: Component): Set<ComponentInstance> | undefined {
        // Retrieve a set of instances by component function reference
        return COMPONENTMAP.get(componentFn);
    },
    getInstanceById(id: number): ComponentInstance | undefined {
        return IDMAP.get(id);
    },
    findInstances(channel: string, room: string) {
        // Allow searching by stuff
    },
    getAbilities(componentInstance: ComponentInstance): Abilities | undefined {
        // Retrieve the internals for an instance.
        // This is interesting because it allows outside access to instance id, room, methods, etc.,
        // while still allowing us to use plain unmodified HTMLElements directly, without wrapping them in objects
        return ABILITYMAP.get(componentInstance);
    },
    get channels(): string[] {
        return [...CHANNELCALLBACKMAP.keys()];
    },
    deleteChannel(channel: string): void {
        CHANNELCALLBACKMAP.delete(channel);
    },
    hasChannel(channel: string): boolean {
        return CHANNELCALLBACKMAP.has(channel);
    },
});

export default sw;