interface ListNode<T> {
	next?: ListNode<T>;
	value: T;
}

class LinkedList<T> {
	/** First node in the list. Cannot be removed. */
	head: ListNode<T>;

	/** Last node in the list. If it is removed, this property will be updated. */
	lastNode: ListNode<T>;

	constructor() {
		this.head = { next: null, value: null };
		this.lastNode = this.head;
	}

	/** Inserts a new node with the given value after the last node. */
	insert(value: T): ListNode<T> {
		return this.insertAfter(this.lastNode, value);
	}

	/** Inserts a new node with the given value after the specified node. */
	insertAfter(node: ListNode<T>, value: T): ListNode<T> {
		if (node == null) {
			throw new Error("Reference node cannot be null.");
		}
		const newNode = { next: node.next, value: value };
		node.next = newNode;
		if (node === this.lastNode) {
			this.lastNode = newNode;
		}
		return newNode;
	}

	/** Removes a node from the list. */
	deleteAfter(node: ListNode<T>): ListNode<T> {
		if (node == null) {
			throw new Error("Reference node cannot be null.");
		}
		const oldNode = node.next;
		if (oldNode == null) {
			return null;
		}
		if (oldNode === this.lastNode) {
			this.lastNode = node;
		}
		node.next = oldNode.next;
		delete oldNode.next;
		return oldNode;
	}
}

export { LinkedList };