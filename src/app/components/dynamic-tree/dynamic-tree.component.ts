import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { CollectionViewer, DataSource, SelectionChange } from '@angular/cdk/collections';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Observable, BehaviorSubject } from 'rxjs';
import { FoldersService, Folder } from '../../_services/folders.service';

interface FlatFolderNode {
  folderId: string,
  title: string,
  data: Folder,
  parentIds: string[],
  children: {
    status: NodeChildrenStatus,
    items: FlatFolderNode[],
    promise?: Promise<FlatFolderNode[]>,
    descendantsLoading: string[],
  }
}

enum RootNodesStatus {
  NOOP = 'noop',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

enum NodeChildrenStatus {
  NO_CHILDREN = 'no-children',
  NOT_LOADED = 'not-loaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

type PreSelectionCallbackFn = (node: FlatFolderNode | null, canceled: boolean) => void;


@Component({
  selector: 'app-dynamic-tree',
  templateUrl: './dynamic-tree.component.html',
  styleUrls: ['./dynamic-tree.component.scss']
})
export class DynamicTreeComponent implements OnInit {
  @Input() treeRequired!: boolean;
  @Input() treeForm!: UntypedFormControl;
  @Output() nodeSelectedEvent = new EventEmitter<string>();
  dataSource: FoldersDataSource;
  treeControl!: FlatTreeControl<FlatFolderNode>;
  showFolderTree = false;
  selectedFolderId: string | null = null;
  parentsOfSelectedFolder: Record<string, boolean> = {}

  constructor(
    private foldersSrv: FoldersService,
  ) {
    const getLevel = (node: FlatFolderNode) => node.parentIds.length;
    const isExpandable = (node: FlatFolderNode) => node.data.hasChildren;
    this.treeControl = new FlatTreeControl<FlatFolderNode>(getLevel, isExpandable);
    this.dataSource = new FoldersDataSource(foldersSrv, this.treeControl);
  }

  ngOnInit(): void {
    const defaultValue = (this.treeForm.value.trim() !== '') ? this.treeForm.value : null;
    this.selectedFolderId = defaultValue
    this.dataSource.preSelectValue(this.selectedFolderId, (node: FlatFolderNode | null, canceled) => {

      if (node) {
        const parentsDict = node.parentIds.reduce((acc, id) => ({...acc, [id]: true}), {});
        this.parentsOfSelectedFolder = parentsDict;
      }
      console.group('[DynamicTreeComponent] onDataFetched');
      console.log('defaultValue: ', defaultValue);
      console.log('node: ', node);
      console.log('canceled: ', canceled);
      console.groupEnd();
    });
  }

  public onSelectionToggle(node: FlatFolderNode, change: MatCheckboxChange): void {
    this.dataSource.cancelPreSelection();
    if (change.checked) {
      const parentsDict = node.parentIds.reduce((acc, id) => ({...acc, [id]: true}), {});
      this.selectedFolderId = node.folderId;
      this.parentsOfSelectedFolder = parentsDict;
    } else {
      this.selectedFolderId = null;
    }
  }

  public hasChild(index: number, node: FlatFolderNode): boolean {
    return node.data.hasChildren;
  }

  protected readonly NodeChildrenStatus = NodeChildrenStatus;
}


/**
 * FoldersDataSource
 */
class FoldersDataSource implements DataSource<FlatFolderNode> {
  private fetchedNodes: Record<string, FlatFolderNode> = {};
  private rootFolders: { status: RootNodesStatus, nodes: FlatFolderNode[] };
  private foldersToDisplay: string[] = [];
  private pendingSubFoldersToDisplay: string[] = [];
  private displayedNodes$ = new BehaviorSubject<FlatFolderNode[]>([]);
  private preSelection: { folderId: string | null, cb: PreSelectionCallbackFn, canceled: boolean }

  constructor(
    private foldersSrv: FoldersService,
    private treeControl: FlatTreeControl<FlatFolderNode>,
  ) {
    this.rootFolders = { status: RootNodesStatus.NOOP, nodes: [] };
    this.preSelection = { folderId: null, cb: () => {}, canceled: false };
  }

  // === Init & Destroy =====================================

  public connect(_collectionViewer: CollectionViewer): Observable<FlatFolderNode[]> {
    // The collection should be reasonably small, so collectionViewer can be ignored.

    // Start by loading the root folders.
    this.fetchRootFolders();

    // Update visible nodes & potentially fetch data when user manipulates the tree.
    this.treeControl.expansionModel.changed.subscribe((change: SelectionChange<FlatFolderNode>) => {
      const updated = this.computeStateUpdate(change);
      this.foldersToDisplay = updated.foldersToDisplay;
      this.updateNodesToDisplay();

      // Note that 'fetchSubFolders' might trigger the 'updateNodesToDisplay' later, too.
      this.pendingSubFoldersToDisplay = updated.pendingSubFoldersToDisplay;
      for (const nodeToLoad of updated.nodesToLoad) {
        this.fetchSubFolders(nodeToLoad);
      }
    });

    return this.displayedNodes$;
  }

  public disconnect(_collectionViewer: CollectionViewer): void {
    // TODO
  }

  // === Core logic =========================================

  /***
   * Synchronize the UI state after a user or a data update.
   *
   * This function may be short, but it's the heart of this class data-flow:
   *
   * We need a easy-to-access list of all loaded nodes, which is our `this.fetchedNodes` dictionary.
   * The Material tree component expects an observable of a flat array of all nodes to display,
   * which is `this.displayedNodes$`, returned in `connect()`, but mostly updated here.
   * We bridge both with `this.foldersToDisplay`, a list of folderId (which are also used as node id).
   *
   * We expect the `fetchedNodes` to always contain all known nodes in the tree,
   * and `foldersToDisplay` to be up-to-date after a user update, and after new data has been loaded.
   */
  private updateNodesToDisplay(): void {
    const displayedNodes = this.foldersToDisplay
      .map(folderId => this.fetchedNodes[folderId] || null)
      .filter(node => node !== null) as FlatFolderNode[];
    this.treeControl.dataNodes = displayedNodes;
    this.displayedNodes$.next(displayedNodes);
  }

  /***
   * Compute the data to change after an expand/collapse action.
   * This function is free of side effects.
   */
  private computeStateUpdate(change: SelectionChange<FlatFolderNode>): {
    foldersToDisplay: string[],
    pendingSubFoldersToDisplay: string[],
    nodesToLoad: FlatFolderNode[],
  } {
    let foldersToDisplay = [...this.foldersToDisplay];
    let pendingSubFoldersToDisplay = [...this.pendingSubFoldersToDisplay];
    const nodesToLoad: FlatFolderNode[] = [];

    // Hide any child node of a 'removed' node;
    // Also, potentially cancel the opening of subFolders being fetched.
    if (change.removed.length > 0) {
      for (const nodeToCollapse of change.removed) {
        foldersToDisplay = foldersToDisplay.filter(folderId => {
          const node = this.fetchedNodes[folderId];
          const isChildOfRemovedNode = node.parentIds.includes(nodeToCollapse.folderId);
          return !isChildOfRemovedNode;
        });

        // The folder might potentially still being fetched. Un-mark it for opening then.
        // NOTE: since closing a parent folder adds all it's children in the `changes.removed` array,
        // then closing a parent will still explicitly un-mark a loading folder from opening.
        pendingSubFoldersToDisplay = pendingSubFoldersToDisplay
          .filter(folderId => folderId !== nodeToCollapse.folderId);
      }
    }

    // Either load or display the immediate children of an opened node.
    if (change.added.length > 0) {
      for (const nodeToOpen of change.added) {
        if (nodeToOpen.children.status === NodeChildrenStatus.LOADED) {
          // Insert the child nodes ids right after the node to open.
          const parentNodeIndex = foldersToDisplay.indexOf(nodeToOpen.folderId);
          if (parentNodeIndex > -1) {
            const childNodeIds = nodeToOpen.children.items.map(node => node.folderId);
            foldersToDisplay.splice(parentNodeIndex + 1, 0, ...childNodeIds);
          } else {
            // This should not happen, unless there is a bug.
            console.error('[DynamicTree::treeControl.expansion.changed] BUG: parent node not found.', {
              foldersToDisplay: [...foldersToDisplay],
              parentNode: nodeToOpen,
              parentNodeIndex: parentNodeIndex,
            });
          }
        } else if (nodeToOpen.children.status === NodeChildrenStatus.NOT_LOADED
          || nodeToOpen.children.status === NodeChildrenStatus.ERROR) {
          // Queue the node for fetchSubFolders, and mark for subsequent opening.
          nodesToLoad.push(nodeToOpen);
          pendingSubFoldersToDisplay.push(nodeToOpen.folderId);
        } else if (nodeToOpen.children.status === NodeChildrenStatus.LOADING) {
          // If the user opened, then closed, then re-opened quickly enough,
          // we are still in loading, but we want to mark it again for opening once it's loaded.
          pendingSubFoldersToDisplay.push(nodeToOpen.folderId);
        } else {
          // This branch should never be reach, since it's for an empty node.
          // In any case, nothing to do.
        }
      }
    }

    return {
      foldersToDisplay: foldersToDisplay,
      pendingSubFoldersToDisplay: pendingSubFoldersToDisplay,
      nodesToLoad: nodesToLoad,
    };
  }

  // === Fetching data ======================================

  private fetchRootFolders(): void {
    if (this.rootFolders.status === RootNodesStatus.LOADING) { return; }
    if (this.rootFolders.status === RootNodesStatus.LOADED) { return; }

    this.rootFolders.status = RootNodesStatus.LOADING;
    this.foldersSrv.getRootFolders().then((rootFolders: Folder[]) => {
      const rootNodes = rootFolders.map(folder => this.folderToFlatNode(folder, []));
      for (const node of rootNodes) {
        this.fetchedNodes[node.folderId] = node;
      }

      // Always display the root nodes
      this.rootFolders = { status: RootNodesStatus.LOADED, nodes: rootNodes, };
      this.foldersToDisplay = rootNodes.map(node => node.folderId);
      this.updateNodesToDisplay();

      // Potentially update & query subfolder if a value should be pre-set
      this.updatePreSelectedNodeAfterInitialLoad();
    }).catch((error: any) => {
      this.rootFolders.status = RootNodesStatus.ERROR;
      console.warn('[DynamicTree::fetchRootFolders] ERROR: ', error);
    });
  }

  private fetchSubFolders(parentNode: FlatFolderNode): Promise<FlatFolderNode[]> {
    if (parentNode.children.status === NodeChildrenStatus.LOADING) {
      return parentNode.children.promise as Promise<FlatFolderNode[]>;
    }
    if (parentNode.children.status === NodeChildrenStatus.LOADED) {
      return Promise.resolve(parentNode.children.items);
    }
    if (parentNode.children.status === NodeChildrenStatus.NO_CHILDREN) {
      return Promise.resolve([]);
    }

    parentNode.children.status = NodeChildrenStatus.LOADING;
    this.updateAncestorsChildLoadingStatus(parentNode, true);
    const subNodesPromise = this.foldersSrv.getSubFolders(parentNode.folderId).then((subFolders: Folder[]) => {
      const childParentIds = [...parentNode.parentIds, parentNode.folderId];
      const subNodes = subFolders.map(folder => this.folderToFlatNode(folder, childParentIds));
      for (const node of subNodes) {
        this.fetchedNodes[node.folderId] = node;
      }

      parentNode.children.status = NodeChildrenStatus.LOADED;
      parentNode.children.items = subNodes;
      this.updateAncestorsChildLoadingStatus(parentNode, false);

      // Only display loaded subFolders if the opening hasn't been canceled,
      // and parentNode is still visible.
      const displaySubFolders = this.pendingSubFoldersToDisplay.includes(parentNode.folderId);
      this.pendingSubFoldersToDisplay.filter(folderId => folderId !== parentNode.folderId);
      const foldersToDisplay = [...this.foldersToDisplay];

      // Note that the parentNode may have been hidden from view.
      const parentNodeIndex = foldersToDisplay.indexOf(parentNode.folderId);
      if (parentNodeIndex === -1) {
        // ParentNode have been hidden from view in-between. Do not display subFolders then.
      } else if (displaySubFolders) {
        // Insert the child nodes ids right after the node to open,
        const childNodeIds = parentNode.children.items.map(node => node.folderId);
        foldersToDisplay.splice(parentNodeIndex + 1, 0, ...childNodeIds);
        this.foldersToDisplay = foldersToDisplay;
        this.updateNodesToDisplay();
      }

      return subNodes;
    }).catch((error: any) => {
      parentNode.children.status = NodeChildrenStatus.ERROR;
      this.updateAncestorsChildLoadingStatus(parentNode, false);
      console.warn('[DynamicTree::fetchSubFolders] ERROR: ', {
        error: error,
        parentNode: parentNode,
      });

      return Promise.reject(error);
    });

    parentNode.children.promise = subNodesPromise
    return subNodesPromise;
  }

  private updateAncestorsChildLoadingStatus(parentNode: FlatFolderNode, loading: boolean): void {
    const ancestors = parentNode.parentIds.map(id => this.fetchedNodes[id]);
    if (loading) {
      ancestors.forEach(node => node.children.descendantsLoading.push(parentNode.folderId));
    } else {
      ancestors.forEach(node => {
        node.children.descendantsLoading = node.children.descendantsLoading.filter(id => id !== parentNode.folderId);
      });
    }
  }

  // === Pre-select value & pre-fetch data ==================

  public preSelectValue(folderId: string | null, cb: PreSelectionCallbackFn): void {
    this.preSelection.folderId = folderId;
    this.preSelection.cb = cb;

    if (this.preSelection.canceled || folderId === null || folderId === '') {
      // No folder to pre-select, or another folder has been selected since. Nothing to do.
      // Call the callback, and wrap it up.
      cb(null, this.preSelection.canceled);
    } else if (this.rootFolders.status === RootNodesStatus.LOADED) {
      this.updatePreSelectedNodeAfterInitialLoad();
    } else {
      // We are still waiting for root folders to load.
      // The `fetchRootFolders()` method will call `this.updatePreSelectedNodeAfterInitialLoad()`.
    }
  }

  public cancelPreSelection(): void {
    this.preSelection.canceled = true;
  }

  private async updatePreSelectedNodeAfterInitialLoad(): Promise<void> {
    const preSelectedId = this.preSelection.folderId;
    const cb = this.preSelection.cb;

    // First case: nothing to do.
    if (this.preSelection.canceled || !preSelectedId || preSelectedId === '') {
      cb(null, this.preSelection.canceled);
      return;
    }

    // Second case: preSelected folder is one of the root (or any loaded) folders.
    let preSelectedNode = this.fetchedNodes[preSelectedId] || null;
    if (preSelectedNode) { cb(preSelectedNode, false); return; }

    // Third case: we need to fetch more subfolders to reach preSelectedNode
    let remainingNodes = this.getBreadthFirstListOfNodesToLoad();
    while (!preSelectedNode && remainingNodes.length > 0) {
      const nextNodeToLoad = remainingNodes[0];
      try {
        await this.fetchSubFolders(nextNodeToLoad);
      } catch(e) {}

      // We might have canceled since.
      if (this.preSelection.canceled) {
        cb(null, true);
        return;
      }

      // We don't explicitly search on the just-loaded sub-nodes, since other potential
      // sub-nodes may have been loaded in-between.
      preSelectedNode = this.fetchedNodes[preSelectedId] || null;
      if (preSelectedNode) { cb(preSelectedNode, false); return; }

      remainingNodes = this.getBreadthFirstListOfNodesToLoad();
    }

    // Fourth and last case: we couldn't find the preSelected folder.
    cb(null, this.preSelection.canceled);
  }

  private getBreadthFirstListOfNodesToLoad(): FlatFolderNode[] {
    let breadthFirstNodes: FlatFolderNode[] = [];
    let nextLevelNodes: FlatFolderNode[] = [...this.rootFolders.nodes];

    do {
      breadthFirstNodes = [...breadthFirstNodes, ...nextLevelNodes];
      nextLevelNodes = nextLevelNodes
        .map(node => node.children.items)
        .reduce((acc, arr) => [...acc, ...arr], []);
    } while (nextLevelNodes.length > 0);

    const remainingNodes = breadthFirstNodes
      .filter(node => node.children.status === NodeChildrenStatus.NOT_LOADED);

    return remainingNodes;
  }

  // === Helper =============================================

  private folderToFlatNode(folder: Folder, parentIds: string[]): FlatFolderNode {
    return {
      folderId: folder.folderId,
      title: folder.title,
      data: folder,
      parentIds: parentIds,
      children: {
        status: folder.hasChildren ? NodeChildrenStatus.NOT_LOADED : NodeChildrenStatus.NO_CHILDREN,
        items: [],
        descendantsLoading: [],
      }
    };
  }

}

