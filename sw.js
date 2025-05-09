const COMPONENTS = {};
const TOPICMAP = new Map();
const INSTANCES = {};
const ROOMMAP = new Map();
const LISTENINGMAP = new Map();
const ABILITYMAP = new Map();
const IDMAP = new Map();
let INSTANCECOUNT = 0;
// Listen to a topic and fire a callback when receiving a message
const LISTEN = (topic, callbackWithMetadata, self) => {
    const listenerCallbackMap = TOPICMAP.get(topic);
    if (listenerCallbackMap) {
        const callbackObject = listenerCallbackMap.get(self);
        if (callbackObject) {
            callbackObject.add(callbackWithMetadata);
        }
        else {
            const callbacks = new Set();
            callbacks.add(callbackWithMetadata);
            listenerCallbackMap.set(self, callbacks);
        }
    }
    else {
        const listenerCallbackMap = new Map();
        const callbacks = new Set();
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
const IGNORE = (topic, self) => {
    TOPICMAP.get(topic)?.delete(self);
    LISTENINGMAP.get(self)?.delete(topic);
};
// Ignore everything
const DEAFEN = (self) => {
    LISTENINGMAP.delete(self);
};
// Message the topic in every room
const BROADCAST = (topic, data, speaker) => {
    const listenerCallbackMap = TOPICMAP.get(topic);
    if (!listenerCallbackMap)
        return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const item of callbackSet) {
            if (item.maxTimes !== null && item.timesCalled >= item.maxTimes)
                continue;
            item.timesCalled++;
            item.callback(data, speaker, 'broadcast');
        }
    });
};
// Message the topic in the room. Can't be heard in other rooms
const SHOUT = (topic, data, speaker, room) => {
    const listenerCallbackMap = TOPICMAP.get(topic);
    if (!listenerCallbackMap)
        return;
    for (const [listener, callbackSet] of listenerCallbackMap) {
        if (isInRoom(listener, room)) {
            for (const item of callbackSet) {
                if (item.maxTimes !== null && item.timesCalled >= item.maxTimes)
                    continue;
                item.timesCalled++;
                item.callback(data, speaker, 'shout');
            }
        }
    }
    ;
};
// Message one specific target instance by reference. Can't be heard across rooms
const WHISPER = (target, topic, data, speaker, room) => {
    if (!isInRoom(target, room))
        return;
    const callbackSet = TOPICMAP.get(topic)?.get(target);
    if (!callbackSet)
        return;
    for (const item of callbackSet) {
        if (item.maxTimes !== null && item.timesCalled >= item.maxTimes)
            continue;
        item.timesCalled++;
        item.callback(data, speaker, 'whisper');
    }
};
// Set a persistent message on a topic that can be picked up at any time.
// This is different from other events in that it can be listened to after it is fired.
// Echoing again on the same topic refires callbacks for all listeners.
// Can't be heard across rooms
const ECHO = (topic, data, speaker, room) => {
    // Could echo fire a whisper any time a new listener is added?
};
const checkForEchoes = (topic, callback, self) => {
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
const areInSameRoom = (componentInstance1, componentInstance2) => {
    // Don't really need this
    const room = getAbilities(componentInstance1)?.getRoom().name;
    return !!room && room === getAbilities(componentInstance2)?.getRoom().name;
};
const isInRoom = (componentInstance, room) => {
    return ROOMMAP.get(room)?.has(componentInstance) ?? false;
};
const enterRoom = (room, componentInstance) => {
    const instanceSet = ROOMMAP.get(room);
    if (instanceSet) {
        instanceSet.add(componentInstance);
    }
    else {
        const instanceSet = new Set();
        instanceSet.add(componentInstance);
        ROOMMAP.set(room, instanceSet);
    }
    componentInstance.dataset.swRoom = room ?? '';
};
const leaveRoom = (room, componentInstance) => {
    ROOMMAP.get(room)?.delete(componentInstance);
    componentInstance.dataset.swRoom = '';
};
const define = (componentFn) => {
    if (typeof componentFn !== 'function' || !componentFn.name || componentFn.constructor.name !== 'AsyncFunction') {
        throw new Error(`Component definition must use an async named function: async function ComponentName()`);
    }
    const build = async (props) => {
        let isMounting = true;
        const instanceId = INSTANCECOUNT++;
        let room = '';
        // We are using a Promise to resolve a circular dependency.
        // In order for the methods like listen() to work, they need the component instance to finish firing and return its value, element.
        // But the methods are available inside the component instance and can be fired immediately, and need to pass in element for them to work.
        // So the promise is there to force the methods to wait for the instance to finish returning before they can fire.
        // Otherwise, "element" here is undefined and this breaks.
        // The method might not be fired immediately though, so we check isMounting to see if the component instance has returned already.
        // withResolvers is pretty new - Baseline 2024. Allows access to the resolver from outside. 
        // Not needed but better than the old way to do this
        const { promise: getElement, resolve: resolveElement, reject: rejectElement } = Promise.withResolvers();
        const fire = (fn, ...args) => {
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
        const abilities = Object.freeze({
            getId() {
                return instanceId;
            },
            getRoom() {
                return {
                    name: room,
                    roommates: [...ROOMMAP.get(room) ?? []]
                };
            },
            setRoom(newRoom) {
                fire(leaveRoom, room);
                room = newRoom;
                fire(enterRoom, room);
            },
            getListeningTo() {
                // Not good
                // If you fire this during mount, element won't exist
                // Currently not working
                return LISTENINGMAP.get(element);
            },
            whisper(target, topic, data) {
                fire(WHISPER, target, topic, data);
            },
            shout(topic, data) {
                fire(SHOUT, topic, data);
            },
            broadcast(topic, data) {
                fire(BROADCAST, topic, data);
            },
            echo(topic, data) {
            },
            listen(topic, callback, numberOfTimes) {
                const metadata = {
                    callback,
                    topic,
                    timesCalled: 0,
                    maxTimes: numberOfTimes || null
                };
                fire(LISTEN, topic, metadata);
            },
            ignore(topic) {
                fire(IGNORE, topic, element);
            },
            deafen() {
            },
            destroy() {
                element.remove();
                IDMAP.delete(instanceId);
                LISTENINGMAP.delete(element);
                ABILITYMAP.delete(element);
                ROOMMAP.get(room)?.delete(element);
                INSTANCES[componentFn.name].splice(INSTANCES[componentFn.name].indexOf(metadata), 1);
                room = null;
                metadata = null;
                element = null;
            }
        });
        let element = await componentFn(abilities, props);
        if (!(element instanceof HTMLElement)) {
            rejectElement();
            throw new Error(`Component definition must return an HTMLElement.`);
        }
        let metadata = {
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
        element.dataset.swComponent = componentFn.name;
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
};
const getAbilities = (componentInstance) => {
    // Retrieve the internals for an instance.
    // This is interesting because it allows outside access to instance id, room, methods, etc.,
    // while still allowing us to use plain unmodified HTMLElements directly, without wrapping them in objects
    // Opens up the possibility of an impersonate() ability,
    // where components fire other components' abilties but leave some audit trail
    // Although this leads to some insane complexity and breaks encapsulation
    return ABILITYMAP.get(componentInstance);
};
const getInstancesByRoom = (room) => {
    const roommates = ROOMMAP.get(room);
    const x = {};
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
        return { ...COMPONENTS };
    },
    define,
    build(componentName, props = {}) {
        if (typeof COMPONENTS[componentName] !== 'function')
            throw new Error(`Component "${componentName}" isn't defined.`);
        return COMPONENTS[componentName](props);
    },
    find(query) {
        if (!query)
            return [];
        if (typeof query.component === 'undefined' && typeof query.room === 'undefined')
            return [];
        if (typeof query.room === 'undefined')
            return INSTANCES[query.component];
        if (typeof query.component === 'undefined') {
            return getInstancesByRoom(query.room); // this is returning an object, should return array
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
