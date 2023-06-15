import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { CollectionViewer, DataSource, SelectionChange } from '@angular/cdk/collections';
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
  selectedId: string | null = null;

  constructor(
    private foldersSrv: FoldersService,
  ) {
    const getLevel = (node: FlatFolderNode) => node.parentIds.length;
    const isExpandable = (node: FlatFolderNode) => node.data.hasChildren;
    this.treeControl = new FlatTreeControl<FlatFolderNode>(getLevel, isExpandable);
    this.dataSource = new FoldersDataSource(foldersSrv, this.treeControl);
  }

  ngOnInit(): void {
    this.selectedId = null;
  }

  // TMP
  public checklistSelection = {
    isEmpty: () => true,
    isSelected: (node: Folder) => false,
  }

  public itemSelectionToggle(node: FlatFolderNode): void {
    // TODO
    console.group('[DynamicTreeComponent] itemSelectionToggle');
    console.log('node: ', node);
    console.groupEnd();
  }

  public leafItemSelectionToggle(node: FlatFolderNode): void {
    // TODO
    console.group('[DynamicTreeComponent] leafItemSelectionToggle');
    console.log('node: ', node);
    console.groupEnd();
  }

  public hasChild(index: number, node: FlatFolderNode): boolean {
    // console.group('[DynamicTreeComponent] hasChild');
    // console.log('index: ', index);
    // console.log('node: ', node);
    // console.groupEnd();
    // TODO
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

  constructor(
    private foldersSrv: FoldersService,
    private treeControl: FlatTreeControl<FlatFolderNode>,
  ) {
    this.rootFolders = { status: RootNodesStatus.NOOP, nodes: [] };
    this.fetchRootFolders();
  }

  // === Init & Destroy =====================================

  public connect(_collectionViewer: CollectionViewer): Observable<FlatFolderNode[]> {
    // The collection should be reasonably small, so collectionViewer can be ignored.

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
      .filter(node => node !== null);
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
    }).catch((error: any) => {
      this.rootFolders.status = RootNodesStatus.ERROR;
      console.warn('[DynamicTree::fetchRootFolders] ERROR: ', error);
    });
  }

  private fetchSubFolders(parentNode: FlatFolderNode): void {
    if (parentNode.children.status === NodeChildrenStatus.LOADING) { return; }
    if (parentNode.children.status === NodeChildrenStatus.LOADED) { return; }
    if (parentNode.children.status === NodeChildrenStatus.NO_CHILDREN) { return; }

    parentNode.children.status = NodeChildrenStatus.LOADING;
    this.foldersSrv.getSubFolders(parentNode.folderId).then((subFolders: Folder[]) => {
      const childParentIds = [...parentNode.parentIds, parentNode.folderId];
      const subNodes = subFolders.map(folder => this.folderToFlatNode(folder, childParentIds));
      for (const node of subNodes) {
        this.fetchedNodes[node.folderId] = node;
      }

      parentNode.children.status = NodeChildrenStatus.LOADED;
      parentNode.children.items = subNodes;

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
    }).catch((error: any) => {
      parentNode.children.status = NodeChildrenStatus.ERROR;
      console.warn('[DynamicTree::fetchSubFolders] ERROR: ', {
        error: error,
        parentNode: parentNode,
      });
    })
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
      }
    };
  }

}

